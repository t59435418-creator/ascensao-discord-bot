import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const trapChannelsTable = pgTable("discord_trap_channels", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  actionMessage: text("action_message").notNull().default("kick"),
  actionImage: text("action_image").notNull().default("ban"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const giveawaysTable = pgTable("discord_giveaways", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  prize: text("prize").notNull(),
  winnersCount: integer("winners_count").notNull().default(1),
  hostedBy: text("hosted_by").notNull(),
  endAt: timestamp("end_at").notNull(),
  ended: boolean("ended").notNull().default(false),
  participants: text("participants").notNull().default(""),
  winners: text("winners").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const eventsTable = pgTable("discord_events", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  eventAt: timestamp("event_at").notNull(),
  createdBy: text("created_by").notNull(),
  ended: boolean("ended").notNull().default(false),
  participants: text("participants").notNull().default(""),
  prize: text("prize"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TrapChannel = typeof trapChannelsTable.$inferSelect;
export type Giveaway = typeof giveawaysTable.$inferSelect;
export type DiscordEvent = typeof eventsTable.$inferSelect;
