import { pgTable, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const levelsTable = pgTable("discord_levels", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  guildId: text("guild_id").notNull(),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(0),
  totalMessages: integer("total_messages").notNull().default(0),
  lastXpAt: timestamp("last_xp_at"),
});

export const levelRewardsTable = pgTable("discord_level_rewards", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  level: integer("level").notNull(),
  roleId: text("role_id").notNull(),
});

export const welcomeConfigTable = pgTable("discord_welcome_config", {
  id: text("id").primaryKey(),
  welcomeEnabled: boolean("welcome_enabled").notNull().default(true),
  welcomeChannelId: text("welcome_channel_id"),
  welcomeMessage: text("welcome_message").notNull().default("Bem-vindo(a) ao servidor, {user}! 🎉"),
  welcomeColor: integer("welcome_color").notNull().default(0x5865f2),
  goodbyeEnabled: boolean("goodbye_enabled").notNull().default(false),
  goodbyeChannelId: text("goodbye_channel_id"),
  goodbyeMessage: text("goodbye_message").notNull().default("**{username}** saiu do servidor. 👋"),
  dmWelcome: boolean("dm_welcome").notNull().default(false),
  dmMessage: text("dm_message").notNull().default("Bem-vindo(a) ao **{server}**! Use /ajuda para ver todos os comandos."),
  levelUpChannelId: text("level_up_channel_id"),
  levelUpEnabled: boolean("level_up_enabled").notNull().default(true),
});

export const logsConfigTable = pgTable("discord_logs_config", {
  id: text("id").primaryKey(),
  modLogChannel: text("mod_log_channel"),
  memberLogChannel: text("member_log_channel"),
  messageLogChannel: text("message_log_channel"),
  voiceLogChannel: text("voice_log_channel"),
  serverLogChannel: text("server_log_channel"),
  enabled: boolean("enabled").notNull().default(true),
});

export const pollsTable = pgTable("discord_polls", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  question: text("question").notNull(),
  options: text("options").notNull(),
  votes: text("votes").notNull().default("{}"),
  voterIds: text("voter_ids").notNull().default(""),
  createdBy: text("created_by").notNull(),
  endAt: timestamp("end_at"),
  ended: boolean("ended").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const starboardConfigTable = pgTable("discord_starboard_config", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull(),
  threshold: integer("threshold").notNull().default(3),
  emoji: text("emoji").notNull().default("⭐"),
  enabled: boolean("enabled").notNull().default(true),
});

export const starboardEntriesTable = pgTable("discord_starboard_entries", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  originalMessageId: text("original_message_id").notNull(),
  starboardMessageId: text("starboard_message_id"),
  authorId: text("author_id").notNull(),
  channelId: text("channel_id").notNull(),
  starCount: integer("star_count").notNull().default(0),
  content: text("content").notNull().default(""),
});

export const automodConfigTable = pgTable("discord_automod_config", {
  id: text("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  antiSpamEnabled: boolean("anti_spam_enabled").notNull().default(true),
  antiSpamThreshold: integer("anti_spam_threshold").notNull().default(5),
  antiSpamSeconds: integer("anti_spam_seconds").notNull().default(3),
  antiLinkEnabled: boolean("anti_link_enabled").notNull().default(false),
  allowedDomains: text("allowed_domains").notNull().default(""),
  badWordsEnabled: boolean("bad_words_enabled").notNull().default(false),
  badWords: text("bad_words").notNull().default(""),
  antiMentionEnabled: boolean("anti_mention_enabled").notNull().default(true),
  mentionThreshold: integer("mention_threshold").notNull().default(5),
  action: text("action").notNull().default("delete"),
  logChannel: text("log_channel"),
  ignoredRoles: text("ignored_roles").notNull().default(""),
  ignoredChannels: text("ignored_channels").notNull().default(""),
});

export const reactionRolePanelsTable = pgTable("discord_reaction_role_panels", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  color: integer("color").notNull().default(0x5865f2),
  buttons: text("buttons").notNull().default("[]"),
});

export const remindersTable = pgTable("discord_reminders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  reminder: text("reminder").notNull(),
  remindAt: timestamp("remind_at").notNull(),
  reminded: boolean("reminded").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reputationTable = pgTable("discord_reputation", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  reputation: integer("reputation").notNull().default(0),
  lastGivenAt: timestamp("last_given_at"),
  lastGivenTo: text("last_given_to"),
});

export type Level = typeof levelsTable.$inferSelect;
export type WelcomeConfig = typeof welcomeConfigTable.$inferSelect;
export type LogsConfig = typeof logsConfigTable.$inferSelect;
export type Poll = typeof pollsTable.$inferSelect;
export type StarboardConfig = typeof starboardConfigTable.$inferSelect;
export type AutomodConfig = typeof automodConfigTable.$inferSelect;
export type ReactionRolePanel = typeof reactionRolePanelsTable.$inferSelect;
export type Reminder = typeof remindersTable.$inferSelect;
