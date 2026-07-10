import { Router, type IRouter } from "express";
import { desc, count } from "drizzle-orm";
import { db, usersTable, userCardsTable, collaboratorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/rankings", async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.points));
  const totalCount = await db.select({ count: count() }).from(collaboratorsTable);
  const total = Number(totalCount[0]?.count ?? 1);

  const cardCounts = await db
    .select({ userId: userCardsTable.userId, count: count() })
    .from(userCardsTable)
    .groupBy(userCardsTable.userId);

  const countMap = new Map(cardCounts.map((c) => [c.userId, Number(c.count)]));

  const rankings = users.map((u, index) => {
    const unlockedCount = countMap.get(u.id) ?? 0;
    return {
      rank: index + 1,
      userId: u.id,
      name: u.name,
      photo: u.photo,
      points: u.points,
      unlockedCount,
      progress: total > 0 ? (unlockedCount / total) * 100 : 0,
    };
  });

  res.json(rankings);
});

export default router;
