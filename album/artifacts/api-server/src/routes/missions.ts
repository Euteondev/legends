import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import {
  db,
  missionsTable,
  userMissionsTable,
  userCardsTable,
  usersTable,
  collaboratorsTable,
} from "@workspace/db";
import {
  CreateMissionBody,
  UpdateMissionParams,
  UpdateMissionBody,
  DeleteMissionParams,
  StartMissionParams,
  CompleteMissionParams,
  SubmitMissionProofParams,
  SubmitMissionProofBody,
} from "@workspace/api-zod";
import {
  awardRandomCard,
  buildProgress,
  tickAutoMissions,
  logEvent,
} from "../lib/mission-utils";

const router: IRouter = Router();

// ── Shared helper ─────────────────────────────────────────────────────────────
async function getUnlockedCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(userCardsTable)
    .innerJoin(collaboratorsTable, eq(userCardsTable.collaboratorId, collaboratorsTable.id))
    .where(eq(userCardsTable.userId, userId));
  return Number(row?.count ?? 0);
}

// ── Admin: list all missions (including closed) ───────────────────────────────
router.get("/missions", async (_req, res): Promise<void> => {
  const rows = await db.select().from(missionsTable).orderBy(missionsTable.id);
  res.json(rows);
});

// ── Admin: create mission ─────────────────────────────────────────────────────
router.post("/missions", async (req, res): Promise<void> => {
  const parsed = CreateMissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(missionsTable).values(parsed.data).returning();
  res.status(201).json(row);
});

// ── Admin: update mission ─────────────────────────────────────────────────────
router.patch("/missions/:id", async (req, res): Promise<void> => {
  const params = UpdateMissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(missionsTable)
    .set(parsed.data)
    .where(eq(missionsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Mission not found" });
    return;
  }
  res.json(row);
});

// ── Admin: delete mission ─────────────────────────────────────────────────────
router.delete("/missions/:id", async (req, res): Promise<void> => {
  const params = DeleteMissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(missionsTable)
    .where(eq(missionsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Mission not found" });
    return;
  }
  res.sendStatus(204);
});

// ── User: get my missions (open only) ─────────────────────────────────────────
router.get("/users/me/missions", async (req, res): Promise<void> => {
  const missions = await db
    .select()
    .from(missionsTable)
    .where(eq(missionsTable.status, "open"))
    .orderBy(missionsTable.id);

  const rawId = req.headers["x-user-id"];
  if (!rawId) {
    res.json(missions.map((m) => buildProgress(m, undefined, 0)));
    return;
  }

  const userId = parseInt(Array.isArray(rawId) ? rawId[0]! : rawId, 10);
  const unlockedCount = await getUnlockedCount(userId);

  const userMissions = await db
    .select()
    .from(userMissionsTable)
    .where(eq(userMissionsTable.userId, userId));

  const umMap = new Map(userMissions.map((um) => [um.missionId, um]));

  // Calculate album percent for album_percent missions
  const [userCardCount] = await db
    .select({ count: count() })
    .from(userCardsTable)
    .where(eq(userCardsTable.userId, userId));
  const [allCollaboratorCount] = await db
    .select({ count: count() })
    .from(collaboratorsTable);
  const totalCollabs = Number(allCollaboratorCount?.count ?? 1);
  const albumPercent = totalCollabs > 0
    ? Math.round((Number(userCardCount?.count ?? 0) / totalCollabs) * 100)
    : 0;

  res.json(missions.map((m) => buildProgress(m, umMap.get(m.id), unlockedCount, albumPercent)));
});

// ── User: start a mission ─────────────────────────────────────────────────────
router.post("/users/me/missions/:missionId/start", async (req, res): Promise<void> => {
  const rawId = req.headers["x-user-id"];
  if (!rawId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const params = StartMissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = parseInt(Array.isArray(rawId) ? rawId[0]! : rawId, 10);

  const [mission] = await db
    .select()
    .from(missionsTable)
    .where(
      and(
        eq(missionsTable.id, params.data.missionId),
        eq(missionsTable.status, "open")
      )
    );

  if (!mission) {
    res.status(404).json({ error: "Mission not found or not open" });
    return;
  }

  const [existing] = await db
    .select()
    .from(userMissionsTable)
    .where(
      and(
        eq(userMissionsTable.userId, userId),
        eq(userMissionsTable.missionId, params.data.missionId)
      )
    );

  const unlockedCount = await getUnlockedCount(userId);

  if (existing) {
    res.json(buildProgress(mission, existing, unlockedCount));
    return;
  }

  const now = new Date();
  await db.insert(userMissionsTable).values({
    userId,
    missionId: params.data.missionId,
    progress: 0,
    completed: false,
    submissionStatus: "in_progress",
    startedAt: now,
  });

  await logEvent(userId, "mission_start", params.data.missionId);

  const [newUm] = await db
    .select()
    .from(userMissionsTable)
    .where(
      and(
        eq(userMissionsTable.userId, userId),
        eq(userMissionsTable.missionId, params.data.missionId)
      )
    );

  res.json(buildProgress(mission, newUm, unlockedCount));
});

// ── User: submit evidence proof ───────────────────────────────────────────────
router.post("/users/me/missions/:missionId/submit", async (req, res): Promise<void> => {
  const rawId = req.headers["x-user-id"];
  if (!rawId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const params = SubmitMissionProofParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = SubmitMissionProofBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const userId = parseInt(Array.isArray(rawId) ? rawId[0]! : rawId, 10);

  const [mission] = await db
    .select()
    .from(missionsTable)
    .where(
      and(
        eq(missionsTable.id, params.data.missionId),
        eq(missionsTable.status, "open")
      )
    );

  if (!mission) {
    res.status(404).json({ error: "Mission not found or not open" });
    return;
  }

  if (mission.type !== "evidence") {
    res.status(400).json({ error: "This mission does not require evidence submission" });
    return;
  }

  // Upsert user mission
  const [existing] = await db
    .select()
    .from(userMissionsTable)
    .where(
      and(
        eq(userMissionsTable.userId, userId),
        eq(userMissionsTable.missionId, params.data.missionId)
      )
    );

  const now = new Date();

  if (existing) {
    if (existing.completed) {
      res.status(400).json({ error: "Mission already completed" });
      return;
    }
    await db
      .update(userMissionsTable)
      .set({
        proofText: body.data.proofText,
        submissionStatus: "pending_review",
        startedAt: existing.startedAt ?? now,
      })
      .where(eq(userMissionsTable.id, existing.id));
  } else {
    await db.insert(userMissionsTable).values({
      userId,
      missionId: params.data.missionId,
      progress: 0,
      completed: false,
      submissionStatus: "pending_review",
      proofText: body.data.proofText,
      startedAt: now,
    });
  }

  await logEvent(userId, "mission_submit", params.data.missionId, {
    proofLength: body.data.proofText.length,
  });

  const [um] = await db
    .select()
    .from(userMissionsTable)
    .where(
      and(
        eq(userMissionsTable.userId, userId),
        eq(userMissionsTable.missionId, params.data.missionId)
      )
    );

  const unlockedCount = await getUnlockedCount(userId);
  res.json(buildProgress(mission, um, unlockedCount));
});

// ── User: complete auto mission and claim reward ──────────────────────────────
router.post("/users/me/missions/:missionId/complete", async (req, res): Promise<void> => {
  const rawId = req.headers["x-user-id"];
  if (!rawId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const params = CompleteMissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = parseInt(Array.isArray(rawId) ? rawId[0]! : rawId, 10);

  const [mission] = await db
    .select()
    .from(missionsTable)
    .where(eq(missionsTable.id, params.data.missionId));

  if (!mission) {
    res.status(404).json({ error: "Mission not found" });
    return;
  }

  if (mission.type === "evidence") {
    res.status(400).json({ error: "Evidence missions are completed via admin approval" });
    return;
  }

  const [um] = await db
    .select()
    .from(userMissionsTable)
    .where(
      and(
        eq(userMissionsTable.userId, userId),
        eq(userMissionsTable.missionId, params.data.missionId)
      )
    );

  if (!um) {
    res.status(400).json({ error: "Mission not started" });
    return;
  }

  if (um.completed) {
    res.status(400).json({ error: "Mission already completed" });
    return;
  }

  const unlockedCount = await getUnlockedCount(userId);

  // Validate goal is reached
  let progress = um.progress;
  if (mission.missionType === "unlock_cards") {
    progress = Math.min(unlockedCount, mission.goal);
  }

  if (progress < mission.goal) {
    res.status(400).json({ error: `Goal not reached: ${progress}/${mission.goal}` });
    return;
  }

  const now = new Date();
  const { card: rewardCard, bonusPoints } = await awardRandomCard(userId);

  await db
    .update(userMissionsTable)
    .set({
      submissionStatus: "approved",
      completed: true,
      completedAt: now,
      progress: mission.goal,
    })
    .where(eq(userMissionsTable.id, um.id));

  await logEvent(userId, "mission_complete", params.data.missionId, {
    rewardCardId: rewardCard?.id,
    bonusPoints,
  });

  const [updatedUm] = await db
    .select()
    .from(userMissionsTable)
    .where(eq(userMissionsTable.id, um.id));

  // After awarding card, recount
  const newUnlockedCount = await getUnlockedCount(userId);

  res.json({
    mission: buildProgress(mission, updatedUm, newUnlockedCount),
    rewardCard: rewardCard ?? null,
    bonusPoints,
  });
});

export default router;
