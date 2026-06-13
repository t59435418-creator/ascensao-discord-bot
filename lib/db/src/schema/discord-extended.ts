import { pgTable, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const afkTable = pgTable("discord_afk", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  guildId: text("guild_id").notNull(),
  motivo: text("motivo").notNull().default("AFK"),
  setAt: timestamp("set_at").notNull().defaultNow(),
});

export const ticketConfigTable = pgTable("discord_ticket_config", {
  guildId: text("guild_id").primaryKey(),
  channelId: text("channel_id"),
  transcriptChannelId: text("transcript_channel_id"),
  supportRoleId: text("support_role_id"),
  viewRoleId: text("view_role_id"),
  manageRoleId: text("manage_role_id"),
  mentionRoleId: text("mention_role_id"),
  panelMessageId: text("panel_message_id"),
  panelChannelId: text("panel_channel_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ticketsTable = pgTable("discord_tickets", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  channelId: text("channel_id").notNull(),
  status: text("status").notNull().default("open"),
  closedBy: text("closed_by"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ratingsTable = pgTable("discord_ratings", {
  id: text("id").primaryKey(),
  targetId: text("target_id").notNull(),
  guildId: text("guild_id").notNull(),
  raterId: text("rater_id").notNull(),
  stars: integer("stars").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const partnershipConfigTable = pgTable("discord_partnership_config", {
  guildId: text("guild_id").primaryKey(),
  channelId: text("channel_id"),
  roleId: text("role_id"),
  template: text("template"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const antiraidConfigTable = pgTable("discord_antiraid_config", {
  guildId: text("guild_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  joinThreshold: integer("join_threshold").notNull().default(10),
  joinWindowSeconds: integer("join_window_seconds").notNull().default(10),
  action: text("action").notNull().default("kick"),
  minAccountAgeDays: integer("min_account_age_days").notNull().default(7),
  lockdownEnabled: boolean("lockdown_enabled").notNull().default(false),
  logChannelId: text("log_channel_id"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AfkUser = typeof afkTable.$inferSelect;
export type TicketConfig = typeof ticketConfigTable.$inferSelect;
export type Ticket = typeof ticketsTable.$inferSelect;
export type Rating = typeof ratingsTable.$inferSelect;
export type PartnershipConfig = typeof partnershipConfigTable.$inferSelect;
export type AntiraidConfig = typeof antiraidConfigTable.$inferSelect;
