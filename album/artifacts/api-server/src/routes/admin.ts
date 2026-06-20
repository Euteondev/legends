import { Router, type IRouter, type Request } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  userMissionsTable,
  missionsTable,
  usersTable,
  userCardsTable,
} from "@workspace/db";
import { count } from "drizzle-orm";
import { awardRandomCard, buildProgress, logEvent } from "../lib/mission-utils";
import {
  ApproveMissionParams,
  RejectMissionParams,
  RejectMissionBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

/** Guard: only admin users can access /admin/* */
async function isAdmin(req: Request): Promise<boolean> {
  const rawId = req.headers["x-user-id"];
  if (!rawId) return false;
  const id = parseInt(Array.isArray(rawId) ? rawId[0]! : rawId, 10);
  if (isNaN(id)) return false;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return !!user?.isAdmin;
}

// ── GET /admin/missions/pending ───────────────────────────────────────────────
router.get("/admin/missions/pending", async (req, res): Promise<void> => {
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const pending = await db
    .select()
    .from(userMissionsTable)
    .where(eq(userMissionsTable.submissionStatus, "pending_review"));

  const result = await Promise.all(
    pending.map(async (um) => {
      const [mission] = await db
        .select()
        .from(missionsTable)
        .where(eq(missionsTable.id, um.missionId));
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, um.userId));

      return {
        userMissionId: um.id,
        userId: um.userId,
        userName: user?.name ?? "Unknown",
        userPhoto: user?.photo ?? null,
        missionId: um.missionId,
        missionTitle: mission?.title ?? "Unknown",
        missionType: mission?.type ?? "evidence",
        proofText: um.proofText ?? "",
        submittedAt: um.startedAt?.toISOString() ?? null,
      };
    })
  );

  res.json(result);
});

// ── POST /admin/missions/:userMissionId/approve ───────────────────────────────
router.post("/admin/missions/:userMissionId/approve", async (req, res): Promise<void> => {
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const params = ApproveMissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rawAdminId = req.headers["x-user-id"];
  const adminId = parseInt(Array.isArray(rawAdminId) ? rawAdminId[0]! : rawAdminId!, 10);

  const [um] = await db
    .select()
    .from(userMissionsTable)
    .where(eq(userMissionsTable.id, params.data.userMissionId));

  if (!um) {
    res.status(404).json({ error: "UserMission not found" });
    return;
  }

  const [mission] = await db
    .select()
    .from(missionsTable)
    .where(eq(missionsTable.id, um.missionId));

  if (!mission) {
    res.status(404).json({ error: "Mission not found" });
    return;
  }

  const now = new Date();
  const { card: rewardCard, bonusPoints } = await awardRandomCard(um.userId);

  await db
    .update(userMissionsTable)
    .set({
      submissionStatus: "approved",
      completed: true,
      completedAt: now,
      reviewedBy: adminId,
      reviewedAt: now,
      progress: mission.goal,
    })
    .where(eq(userMissionsTable.id, um.id));

  await logEvent(um.userId, "mission_complete", um.missionId, {
    approvedBy: adminId,
    rewardCardId: rewardCard?.id,
  });

  const [cardCount] = await db
    .select({ count: count() })
    .from(userCardsTable)
    .where(eq(userCardsTable.userId, um.userId));
  const unlockedCount = Number(cardCount?.count ?? 0);

  const updatedUm = { ...um, submissionStatus: "approved", completed: true, completedAt: now, reviewedBy: adminId, reviewedAt: now, progress: mission.goal };

  res.json({
    mission: buildProgress(mission, updatedUm, unlockedCount),
    rewardCard: rewardCard ?? null,
    bonusPoints,
  });
});

// ── POST /admin/missions/:userMissionId/reject ────────────────────────────────
router.post("/admin/missions/:userMissionId/reject", async (req, res): Promise<void> => {
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const params = RejectMissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = RejectMissionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const rawAdminId = req.headers["x-user-id"];
  const adminId = parseInt(Array.isArray(rawAdminId) ? rawAdminId[0]! : rawAdminId!, 10);

  const [um] = await db
    .select()
    .from(userMissionsTable)
    .where(eq(userMissionsTable.id, params.data.userMissionId));

  if (!um) {
    res.status(404).json({ error: "UserMission not found" });
    return;
  }

  const [mission] = await db
    .select()
    .from(missionsTable)
    .where(eq(missionsTable.id, um.missionId));

  if (!mission) {
    res.status(404).json({ error: "Mission not found" });
    return;
  }

  const now = new Date();
  await db
    .update(userMissionsTable)
    .set({
      submissionStatus: "rejected",
      reviewNote: body.data.note,
      reviewedBy: adminId,
      reviewedAt: now,
    })
    .where(eq(userMissionsTable.id, um.id));

  await logEvent(um.userId, "mission_rejected", um.missionId, {
    rejectedBy: adminId,
    note: body.data.note,
  });

  const [cardCount] = await db
    .select({ count: count() })
    .from(userCardsTable)
    .where(eq(userCardsTable.userId, um.userId));
  const unlockedCount = Number(cardCount?.count ?? 0);

  const updatedUm = { ...um, submissionStatus: "rejected", reviewNote: body.data.note, reviewedBy: adminId, reviewedAt: now };
  res.json(buildProgress(mission, updatedUm, unlockedCount));
});

export default router;
