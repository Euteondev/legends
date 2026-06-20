import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const collaboratorsTable = pgTable("collaborators", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  area: text("area").notNull(),
  management: text("management").notNull(),
  photoUrl: text("photo_url"),
  yearsAtVale: integer("years_at_vale"),
  superPower: text("super_power"),
  curiosity: text("curiosity"),
  achievement: text("achievement"),
  challengeQuestion: text("challenge_question"),
  challengeAnswer: text("challenge_answer"),
  rarity: text("rarity").notNull().default("comum"),
  category: text("category").notNull(),
  points: integer("points").notNull().default(10),
  isSpecial: boolean("is_special").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCollaboratorSchema = createInsertSchema(collaboratorsTable).omit({ id: true, createdAt: true });
export type InsertCollaborator = z.infer<typeof insertCollaboratorSchema>;
export type Collaborator = typeof collaboratorsTable.$inferSelect;
