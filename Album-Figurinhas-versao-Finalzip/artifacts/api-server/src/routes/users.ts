import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, usersTable, userCardsTable, collaboratorsTable, eventsTable, missionsTable, userMissionsTable } from "@workspace/db";
import {
  RegisterUserBody,
  UpdateMeBody,
  UnlockCardParams,
  ChallengeCardParams,
  ChallengeCardBody,
} from "@workspace/api-zod";
import { recalcUser, tickAutoMissions, tickLoginMissions, logEvent, seedAlbumPercentMissions } from "../lib/mission-utils";

const router: IRouter = Router();

router.get("/users", async (_req, res): Promise<void> => {
  const rows = await db.select().from(usersTable).orderBy(usersTable.points);

  const counts = await db
    .select({ userId: userCardsTable.userId, count: count() })
    .from(userCardsTable)
    .groupBy(userCardsTable.userId);

  const countMap = new Map(counts.map((c) => [c.userId, Number(c.count)]));
  const result = rows.map((u) => ({ ...u, unlockedCount: countMap.get(u.id) ?? 0 }));

  res.json(result);
});

router.post("/users/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email));

  if (existing) {
    await logEvent(existing.id, "login");
    await tickLoginMissions(existing.id);
    const unlockedRows = await db
      .select()
      .from(userCardsTable)
      .where(eq(userCardsTable.userId, existing.id));
    res.json({ ...existing, unlockedCount: unlockedRows.length });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      photo: parsed.data.photo ?? null,
    })
    .returning();

  await logEvent(user!.id, "login");
  await tickLoginMissions(user!.id);

  // Auto-start album_percent missions for new user
  const albumPercentMissions = await db
    .select()
    .from(missionsTable)
    .where(eq(missionsTable.missionType, "album_percent"));
  for (const mission of albumPercentMissions) {
    await db
      .insert(userMissionsTable)
      .values({
        userId: user!.id,
        missionId: mission.id,
        progress: 0,
        completed: false,
        submissionStatus: "in_progress",
      })
      .onConflictDoNothing();
  }

  res.json({ ...user!, unlockedCount: 0 });
});

router.get("/users/me", async (req, res): Promise<void> => {
  const rawId = req.headers["x-user-id"];
  if (!rawId) {
    res.status(404).json({ error: "No user session" });
    return;
  }

  const id = parseInt(Array.isArray(rawId) ? rawId[0]! : rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const unlockedRows = await db
    .select()
    .from(userCardsTable)
    .where(eq(userCardsTable.userId, id));

  res.json({ ...user, unlockedCount: unlockedRows.length });
});

router.patch("/users/me", async (req, res): Promise<void> => {
  const rawId = req.headers["x-user-id"];
  if (!rawId) {
    res.status(404).json({ error: "No user session" });
    return;
  }

  const id = parseInt(Array.isArray(rawId) ? rawId[0]! : rawId, 10);

  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const unlockedRows = await db
    .select()
    .from(userCardsTable)
    .where(eq(userCardsTable.userId, id));

  res.json({ ...user, unlockedCount: unlockedRows.length });
});

router.get("/users/me/cards", async (req, res): Promise<void> => {
  const rawId = req.headers["x-user-id"];
  if (!rawId) {
    res.json([]);
    return;
  }

  const id = parseInt(Array.isArray(rawId) ? rawId[0]! : rawId, 10);
  if (isNaN(id)) {
    res.json([]);
    return;
  }

  const rows = await db
    .select({ collaboratorId: userCardsTable.collaboratorId })
    .from(userCardsTable)
    .where(eq(userCardsTable.userId, id));

  res.json(rows.map((r) => r.collaboratorId));
});

// Admin-only: direct card unlock
router.post("/users/me/cards/:collaboratorId", async (req, res): Promise<void> => {
  const rawId = req.headers["x-user-id"];
  if (!rawId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = parseInt(Array.isArray(rawId) ? rawId[0]! : rawId, 10);

  const [caller] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!caller?.isAdmin) {
    res.status(403).json({ error: "Only admins can unlock cards directly" });
    return;
  }

  const params = UnlockCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(userCardsTable)
    .where(
      and(
        eq(userCardsTable.userId, id),
        eq(userCardsTable.collaboratorId, params.data.collaboratorId)
      )
    );

  if (!existing) {
    await db.insert(userCardsTable).values({
      userId: id,
      collaboratorId: params.data.collaboratorId,
    });
    await logEvent(id, "card_unlock", params.data.collaboratorId);
    await tickAutoMissions(id);
  }

  const updated = await recalcUser(id);
  const unlockedRows = await db
    .select()
    .from(userCardsTable)
    .where(eq(userCardsTable.userId, id));

  res.json({ ...updated!, unlockedCount: unlockedRows.length });
});

// Challenge: answer a question to unlock a locked sticker
router.post("/users/me/cards/:collaboratorId/challenge", async (req, res): Promise<void> => {
  const rawId = req.headers["x-user-id"];
  if (!rawId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const userId = parseInt(Array.isArray(rawId) ? rawId[0]! : rawId, 10);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const params = ChallengeCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = ChallengeCardBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [collaborator] = await db
    .select()
    .from(collaboratorsTable)
    .where(eq(collaboratorsTable.id, params.data.collaboratorId));

  if (!collaborator) {
    res.status(404).json({ error: "Collaborator not found" });
    return;
  }

  // Check if already unlocked
  const [alreadyOwned] = await db
    .select()
    .from(userCardsTable)
    .where(
      and(
        eq(userCardsTable.userId, userId),
        eq(userCardsTable.collaboratorId, collaborator.id)
      )
    );

  if (alreadyOwned) {
    res.json({ success: true, collaborator, message: "Você já possui essa figurinha!" });
    return;
  }

  // Validate answer — if challengeAnswer is set use it exclusively; otherwise fall back to superPower etc.
  const userAnswer = body.data.answer.trim().toLowerCase();
  const candidates = collaborator.challengeAnswer?.trim()
    ? [collaborator.challengeAnswer.trim()]
    : [
        collaborator.superPower,
        collaborator.achievement,
        collaborator.curiosity,
        collaborator.role,
      ].filter(Boolean) as string[];

  const isCorrect = candidates.some((c) => c.trim().toLowerCase() === userAnswer);

  // Also allow partial match (≥70% of words in answer appear in correct value)
  const isPartialMatch = !isCorrect && candidates.some((c) => {
    const cWords = c.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const aWords = userAnswer.split(/\s+/).filter((w) => w.length > 3);
    if (cWords.length === 0 || aWords.length === 0) return false;
    const matched = aWords.filter((w) => cWords.some((cw) => cw.includes(w) || w.includes(cw)));
    return matched.length / Math.max(cWords.length, aWords.length) >= 0.6;
  });

  if (!isCorrect && !isPartialMatch) {
    // Give a hint: only the first letter of the answer
    const firstCandidate = candidates[0] ?? "";
    const hint = firstCandidate.length > 0
      ? firstCandidate[0]!.toUpperCase()
      : undefined;
    res.json({
      success: false,
      message: "Resposta incorreta. Tente novamente!",
      hint,
    });
    return;
  }

  // Correct! Unlock the card
  await db
    .insert(userCardsTable)
    .values({ userId, collaboratorId: collaborator.id })
    .onConflictDoNothing();

  await logEvent(userId, "card_unlock", collaborator.id, { via: "challenge" });
  await tickAutoMissions(userId);
  await recalcUser(userId);

  res.json({
    success: true,
    collaborator,
    message: "Resposta correta! Figurinha desbloqueada! 🎉",
  });
});

export default router;
