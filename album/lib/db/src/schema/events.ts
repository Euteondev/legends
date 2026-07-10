import { pgTable, serial, integer, timestamp, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Audit log for all user actions — drives auto-mission validation
export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  // card_unlock | mission_start | mission_submit | mission_complete | login
  actionType: text("action_type").notNull(),
  targetId: integer("target_id"),   // collaboratorId, missionId, etc.
  metadata: text("metadata"),       // JSON string for extra context
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Event = typeof eventsTable.$inferSelect;
