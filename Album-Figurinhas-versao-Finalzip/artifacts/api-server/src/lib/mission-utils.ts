import { eq, count, and, inArray, sql } from "drizzle-orm";
import {
  db,
  collaboratorsTable,
  userCardsTable,
  userMissionsTable,
  missionsTable,
  usersTable,
  eventsTable,
} from "@workspace/db";

const RARITY_WEIGHTS: Record<string, number> = {
  comum: 60,
  rara: 25,
  epica: 10,
  lendaria: 5,
};

/** Recalculate user points (sum of owned card points) and album progress. */
export async function recalcUser(userId: number) {
  const totalCount = await db.select({ count: count() }).from(collaboratorsTable);
  const total = Number(totalCount[0]?.count ?? 1);

  const unlockedRows = await db
    .select({ collaboratorId: userCardsTable.collaboratorId })
    .from(userCardsTable)
    .where(eq(userCardsTable.userId, userId));

  const unlocked = unlockedRows.length;
  const progress = total > 0 ? (unlocked / total) * 100 : 0;

  let points = 0;
  for (const row of unlockedRows) {
    const [c] = await db
      .select({ points: collaboratorsTable.points })
      .from(collaboratorsTable)
      .where(eq(collaboratorsTable.id, row.collaboratorId));
    if (c) points += c.points;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ progress, points })
    .where(eq(usersTable.id, userId))
    .returning();

  return updated;
}

/** Award a rarity-weighted random card not yet owned. Returns null if all owned. */
export async function awardRandomCard(userId: number): Promise<{
  card: typeof collaboratorsTable.$inferSelect | null;
  bonusPoints: number;
}> {
  const allCollaborators = await db
    .select()
    .from(collaboratorsTable)
    .where(eq(collaboratorsTable.isSpecial, false));

  const ownedCards = await db
    .select({ collaboratorId: userCardsTable.collaboratorId })
    .from(userCardsTable)
    .where(eq(userCardsTable.userId, userId));

  const ownedSet = new Set(ownedCards.map((c) => c.collaboratorId));
  const unowned = allCollaborators.filter((c) => !ownedSet.has(c.id));

  if (unowned.length === 0) {
    const bonusPoints = 25;
    const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    await db
      .update(usersTable)
      .set({ points: (userRow?.points ?? 0) + bonusPoints })
      .where(eq(usersTable.id, userId));
    return { card: null, bonusPoints };
  }

  const byRarity: Record<string, typeof allCollaborators> = {};
  for (const c of unowned) {
    if (!byRarity[c.rarity]) byRarity[c.rarity] = [];
    byRarity[c.rarity]!.push(c);
  }

  const available = Object.keys(RARITY_WEIGHTS).filter(
    (r) => (byRarity[r]?.length ?? 0) > 0
  );
  const totalWeight = available.reduce(
    (sum, r) => sum + (RARITY_WEIGHTS[r] ?? 0),
    0
  );

  let rand = Math.random() * totalWeight;
  let selectedCard: typeof allCollaborators[0] | null = null;

  for (const rarity of available) {
    rand -= RARITY_WEIGHTS[rarity] ?? 0;
    if (rand <= 0) {
      const cards = byRarity[rarity]!;
      selectedCard = cards[Math.floor(Math.random() * cards.length)] ?? null;
      break;
    }
  }

  if (!selectedCard) selectedCard = unowned[0] ?? null;

  if (selectedCard) {
    await db
      .insert(userCardsTable)
      .values({ userId, collaboratorId: selectedCard.id })
      .onConflictDoNothing();
    await recalcUser(userId);
  }

  return { card: selectedCard, bonusPoints: 0 };
}

/** Award the first special card not yet owned (for album % milestones). */
export async function awardSpecialCard(userId: number): Promise<{
  card: typeof collaboratorsTable.$inferSelect | null;
  bonusPoints: number;
}> {
  const specialCards = await db
    .select()
    .from(collaboratorsTable)
    .where(eq(collaboratorsTable.isSpecial, true));

  const ownedCards = await db
    .select({ collaboratorId: userCardsTable.collaboratorId })
    .from(userCardsTable)
    .where(eq(userCardsTable.userId, userId));

  const ownedSet = new Set(ownedCards.map((c) => c.collaboratorId));
  const unownedSpecial = specialCards.filter((c) => !ownedSet.has(c.id));

  if (unownedSpecial.length === 0) {
    // No more special cards — award bonus points
    const bonusPoints = 100;
    const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    await db
      .update(usersTable)
      .set({ points: (userRow?.points ?? 0) + bonusPoints })
      .where(eq(usersTable.id, userId));
    return { card: null, bonusPoints };
  }

  // Pick the first unowned special card
  const selectedCard = unownedSpecial[0]!;
  await db
    .insert(userCardsTable)
    .values({ userId, collaboratorId: selectedCard.id })
    .onConflictDoNothing();
  await recalcUser(userId);

  return { card: selectedCard, bonusPoints: 0 };
}

/** After a card unlock, auto-update progress on all started auto-missions. */
export async function tickAutoMissions(userId: number): Promise<void> {
  const userMissions = await db
    .select()
    .from(userMissionsTable)
    .where(
      and(
        eq(userMissionsTable.userId, userId),
        eq(userMissionsTable.completed, false)
      )
    );

  if (userMissions.length === 0) return;

  const missions = await db
    .select()
    .from(missionsTable)
    .where(
      inArray(
        missionsTable.id,
        userMissions.map((um) => um.missionId)
      )
    );

  const missionMap = new Map(missions.map((m) => [m.id, m]));

  const [cardCount] = await db
    .select({ count: count() })
    .from(userCardsTable)
    .where(eq(userCardsTable.userId, userId));
  const unlockedCount = Number(cardCount?.count ?? 0);

  // Get total collaborators for album_percent calculation
  const [totalCount] = await db.select({ count: count() }).from(collaboratorsTable);
  const total = Number(totalCount?.count ?? 1);
  const albumPercent = Math.round((unlockedCount / total) * 100);

  for (const um of userMissions) {
    const mission = missionMap.get(um.missionId);
    if (!mission || mission.type !== "auto" || mission.status !== "open") continue;

    let newProgress = um.progress;

    if (mission.missionType === "unlock_cards") {
      newProgress = Math.min(unlockedCount, mission.goal);
    } else if (mission.missionType === "album_percent") {
      // Progress is the current album percentage; goal is target percentage (e.g. 80 or 100)
      newProgress = Math.min(albumPercent, mission.goal);
    }

    if (newProgress !== um.progress) {
      await db
        .update(userMissionsTable)
        .set({ progress: newProgress })
        .where(eq(userMissionsTable.id, um.id));
    }

    // Auto-complete album_percent missions when threshold reached
    if (
      mission.missionType === "album_percent" &&
      newProgress >= mission.goal &&
      !um.completed
    ) {
      await db
        .update(userMissionsTable)
        .set({
          progress: mission.goal,
          completed: true,
          completedAt: new Date(),
          submissionStatus: "approved",
        })
        .where(eq(userMissionsTable.id, um.id));

      // Award special card immediately upon auto-completion
      await awardSpecialCard(userId);
      await logEvent(userId, "mission_complete", mission.id, {
        via: "album_percent",
        percent: albumPercent,
      });
    }
  }
}

/**
 * After a login event, update progress on all started daily_login auto-missions.
 * Only one login per calendar day (UTC) is counted.
 */
export async function tickLoginMissions(userId: number): Promise<void> {
  // Count distinct calendar days (UTC) where this user has a login event
  const [row] = await db
    .select({ days: sql<number>`count(distinct date_trunc('day', ${eventsTable.createdAt} at time zone 'UTC'))` })
    .from(eventsTable)
    .where(and(eq(eventsTable.userId, userId), eq(eventsTable.actionType, "login")));

  const loginDays = Number(row?.days ?? 0);

  // Find all open daily_login auto-missions that the user has started
  const userMissions = await db
    .select()
    .from(userMissionsTable)
    .where(and(eq(userMissionsTable.userId, userId), eq(userMissionsTable.completed, false)));

  if (userMissions.length === 0) return;

  const missions = await db
    .select()
    .from(missionsTable)
    .where(
      and(
        inArray(
          missionsTable.id,
          userMissions.map((um) => um.missionId)
        ),
        eq(missionsTable.missionType, "daily_login"),
        eq(missionsTable.status, "open")
      )
    );

  for (const mission of missions) {
    const um = userMissions.find((u) => u.missionId === mission.id);
    if (!um || mission.type !== "auto") continue;

    const newProgress = Math.min(loginDays, mission.goal);

    if (newProgress !== um.progress) {
      await db
        .update(userMissionsTable)
        .set({ progress: newProgress })
        .where(eq(userMissionsTable.id, um.id));
    }

    // Auto-complete when goal reached
    if (newProgress >= mission.goal && !um.completed) {
      await db
        .update(userMissionsTable)
        .set({
          progress: mission.goal,
          completed: true,
          completedAt: new Date(),
          submissionStatus: "approved",
        })
        .where(eq(userMissionsTable.id, um.id));

      await logEvent(userId, "mission_complete", mission.id, { via: "daily_login", days: loginDays });
    }
  }
}

/** Seed the two album-percent milestone missions if they don't exist yet. */
export async function seedAlbumPercentMissions(): Promise<void> {
  const existing = await db
    .select()
    .from(missionsTable)
    .where(eq(missionsTable.missionType, "album_percent"));

  const existingGoals = new Set(existing.map((m) => m.goal));

  const toCreate: { title: string; description: string; goal: number; rewardPoints: number }[] = [];

  if (!existingGoals.has(80)) {
    toCreate.push({
      title: "Quase Lá",
      description: "Complete 80% do álbum para ganhar uma figurinha especial!",
      goal: 80,
      rewardPoints: 200,
    });
  }

  if (!existingGoals.has(100)) {
    toCreate.push({
      title: "Mestre do Álbum",
      description: "Complete 100% do álbum e se torne um verdadeiro Legends!",
      goal: 100,
      rewardPoints: 500,
    });
  }

  for (const m of toCreate) {
    const [created] = await db
      .insert(missionsTable)
      .values({
        title: m.title,
        description: m.description,
        goal: m.goal,
        rewardPoints: m.rewardPoints,
        missionType: "album_percent",
        type: "auto",
        requiresApproval: false,
        status: "open",
      })
      .returning();

    if (created) {
      // Auto-start this mission for all existing users
      const allUsers = await db.select({ id: usersTable.id }).from(usersTable);
      for (const user of allUsers) {
        await db
          .insert(userMissionsTable)
          .values({
            userId: user.id,
            missionId: created.id,
            progress: 0,
            completed: false,
            submissionStatus: "in_progress",
          })
          .onConflictDoNothing();
      }
    }
  }
}

/** Log an audit event. */
export async function logEvent(
  userId: number,
  actionType: string,
  targetId?: number,
  metadata?: Record<string, unknown>
) {
  await db.insert(eventsTable).values({
    userId,
    actionType,
    targetId: targetId ?? null,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

/** Build MissionProgress shape for API response. */
export function buildProgress(
  mission: typeof missionsTable.$inferSelect,
  um: typeof userMissionsTable.$inferSelect | undefined,
  unlockedCount: number,
  albumPercent?: number
) {
  const started = !!um;
  let progress = 0;
  if (um) {
    if (mission.missionType === "unlock_cards") {
      progress = Math.min(unlockedCount, mission.goal);
    } else if (mission.missionType === "album_percent") {
      progress = Math.min(albumPercent ?? 0, mission.goal);
    } else {
      // daily_login and other types: use stored progress (updated by tickLoginMissions)
      progress = um.progress ?? 0;
    }
  }

  return {
    missionId: mission.id,
    title: mission.title,
    description: mission.description,
    goal: mission.goal,
    progress,
    rewardPoints: mission.rewardPoints,
    missionType: mission.missionType,
    type: mission.type,
    status: mission.status,
    requiresApproval: mission.requiresApproval,
    started,
    startedAt: um?.startedAt?.toISOString() ?? null,
    completed: um?.completed ?? false,
    completedAt: um?.completedAt?.toISOString() ?? null,
    submissionStatus: um?.submissionStatus ?? "in_progress",
    proofText: um?.proofText ?? null,
    reviewNote: um?.reviewNote ?? null,
  };
}
