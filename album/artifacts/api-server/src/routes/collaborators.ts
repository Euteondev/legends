import { Router, type IRouter } from "express";
import { eq, ilike, and, type SQL } from "drizzle-orm";
import { db, collaboratorsTable } from "@workspace/db";
import {
  ListCollaboratorsQueryParams,
  CreateCollaboratorBody,
  GetCollaboratorParams,
  UpdateCollaboratorParams,
  UpdateCollaboratorBody,
  DeleteCollaboratorParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/collaborators", async (req, res): Promise<void> => {
  const query = ListCollaboratorsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const filters: SQL[] = [];
  if (query.data.category) filters.push(eq(collaboratorsTable.category, query.data.category));
  if (query.data.rarity) filters.push(eq(collaboratorsTable.rarity, query.data.rarity));
  if (query.data.area) filters.push(eq(collaboratorsTable.area, query.data.area));
  if (query.data.search) filters.push(ilike(collaboratorsTable.name, `%${query.data.search}%`));

  const rows = await db
    .select()
    .from(collaboratorsTable)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(collaboratorsTable.name);

  res.json(rows);
});

router.post("/collaborators", async (req, res): Promise<void> => {
  const parsed = CreateCollaboratorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db.insert(collaboratorsTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/collaborators/featured", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(collaboratorsTable)
    .where(eq(collaboratorsTable.isSpecial, true))
    .orderBy(collaboratorsTable.points)
    .limit(6);

  if (rows.length < 6) {
    const remaining = await db
      .select()
      .from(collaboratorsTable)
      .where(eq(collaboratorsTable.rarity, "lendaria"))
      .limit(6 - rows.length);
    rows.push(...remaining);
  }

  res.json(rows.slice(0, 6));
});

router.get("/collaborators/:id", async (req, res): Promise<void> => {
  const params = GetCollaboratorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(collaboratorsTable)
    .where(eq(collaboratorsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Collaborator not found" });
    return;
  }

  res.json(row);
});

router.patch("/collaborators/:id", async (req, res): Promise<void> => {
  const params = UpdateCollaboratorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCollaboratorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .update(collaboratorsTable)
    .set(parsed.data)
    .where(eq(collaboratorsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Collaborator not found" });
    return;
  }

  res.json(row);
});

router.delete("/collaborators/:id", async (req, res): Promise<void> => {
  const params = DeleteCollaboratorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(collaboratorsTable)
    .where(eq(collaboratorsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Collaborator not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
