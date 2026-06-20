import { pgTable, serial, integer, timestamp, boolean, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { missionsTable } from "./missions";

export const userMissionsTable = pgTable("user_missions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  missionId: integer("mission_id").notNull().references(() => missionsTable.id, { onDelete: "cascade" }),
  progress: integer("progress").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  // submission lifecycle: in_progress → pending_review → approved | rejected
  submissionStatus: text("submission_status").notNull().default("in_progress"),
  proofText: text("proof_text"),
  reviewNote: text("review_note"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type UserMission = typeof userMissionsTable.$inferSelect;
