import { Router, type IRouter } from "express";
import { desc, count, eq } from "drizzle-orm";
import { db, collaboratorsTable, userCardsTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/stats/album", async (_req, res): Promise<void> => {
  const totalRows = await db.select({ count: count() }).from(collaboratorsTable);
  const total = Number(totalRows[0]?.count ?? 0);

  const byRarityRows = await db
    .select({ rarity: collaboratorsTable.rarity, count: count() })
    .from(collaboratorsTable)
    .groupBy(collaboratorsTable.rarity);

  const byCategoryRows = await db
    .select({ category: collaboratorsTable.category, count: count() })
    .from(collaboratorsTable)
    .groupBy(collaboratorsTable.category);

  const totalUsersRows = await db.select({ count: count() }).from(usersTable);
  const totalUnlocksRows = await db.select({ count: count() }).from(userCardsTable);

  const byRarity: Record<string, number> = {
    comum: 0,
    rara: 0,
    epica: 0,
    lendaria: 0,
  };
  byRarityRows.forEach((r) => {
    byRarity[r.rarity] = Number(r.count);
  });

  const byCategory: Record<string, number> = {};
  byCategoryRows.forEach((r) => {
    byCategory[r.category] = Number(r.count);
  });

  res.json({
    total,
    byRarity,
    byCategory,
    totalUsers: Number(totalUsersRows[0]?.count ?? 0),
    totalUnlocks: Number(totalUnlocksRows[0]?.count ?? 0),
  });
});

router.get("/activity/recent", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      userId: userCardsTable.userId,
      collaboratorId: userCardsTable.collaboratorId,
      unlockedAt: userCardsTable.unlockedAt,
      userName: usersTable.name,
      userPhoto: usersTable.photo,
      collaboratorName: collaboratorsTable.name,
      collaboratorPhoto: collaboratorsTable.photoUrl,
      rarity: collaboratorsTable.rarity,
    })
    .from(userCardsTable)
    .innerJoin(usersTable, eq(userCardsTable.userId, usersTable.id))
    .innerJoin(collaboratorsTable, eq(userCardsTable.collaboratorId, collaboratorsTable.id))
    .orderBy(desc(userCardsTable.unlockedAt))
    .limit(20);

  res.json(
    rows.map((r) => ({
      ...r,
      unlockedAt: r.unlockedAt.toISOString(),
    }))
  );
});

export default router;
