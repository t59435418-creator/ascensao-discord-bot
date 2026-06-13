import { pgTable, text, integer, timestamp, boolean, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("discord_users", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  username: text("username").notNull(),
  balance: integer("balance").notNull().default(0),
  lastDaily: timestamp("last_daily"),
  lastMissions: timestamp("last_missions"),
  warnings: integer("warnings").notNull().default(0),
  isMuted: boolean("is_muted").notNull().default(false),
  muteUntil: timestamp("mute_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const missionsTable = pgTable("discord_missions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  guildId: text("guild_id").notNull(),
  missionDate: text("mission_date").notNull(),
  mission1Completed: boolean("mission1_completed").notNull().default(false),
  mission2Completed: boolean("mission2_completed").notNull().default(false),
  mission3Completed: boolean("mission3_completed").notNull().default(false),
  mission1Reward: integer("mission1_reward").notNull().default(0),
  mission2Reward: integer("mission2_reward").notNull().default(0),
  mission3Reward: integer("mission3_reward").notNull().default(0),
  mission1Type: text("mission1_type").notNull().default(""),
  mission2Type: text("mission2_type").notNull().default(""),
  mission3Type: text("mission3_type").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const warningsTable = pgTable("discord_warnings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  guildId: text("guild_id").notNull(),
  moderatorId: text("moderator_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transactionsTable = pgTable("discord_transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  guildId: text("guild_id").notNull(),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const insertMissionSchema = createInsertSchema(missionsTable);
export type InsertMission = z.infer<typeof insertMissionSchema>;
export type Mission = typeof missionsTable.$inferSelect;

export const insertWarningSchema = createInsertSchema(warningsTable);
export type InsertWarning = z.infer<typeof insertWarningSchema>;
export type Warning = typeof warningsTable.$inferSelect;
