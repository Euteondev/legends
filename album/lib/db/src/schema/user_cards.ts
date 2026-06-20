import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { collaboratorsTable } from "./collaborators";

export const userCardsTable = pgTable("user_cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  collaboratorId: integer("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserCard = typeof userCardsTable.$inferSelect;
