import { db } from "./db.js";
import { levelsTable, levelRewardsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { Guild, GuildMember, TextChannel, EmbedBuilder } from "discord.js";

const XP_COOLDOWN_MS = 60_000;
const xpCooldowns = new Map<string, number>();

export function getLevelFromXP(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100));
}
export function getXPForLevel(level: number): number {
  return level * level * 100;
}
export function getXPProgress(xp: number) {
  const level = getLevelFromXP(xp);
  const baseXP = getXPForLevel(level);
  const nextXP = getXPForLevel(level + 1);
  const currentXP = xp - baseXP;
  const neededXP = nextXP - baseXP;
  const percentage = Math.floor((currentXP / neededXP) * 100);
  return { level, currentXP, neededXP, percentage };
}

export function makeProgressBar(percentage: number, length = 15): string {
  const filled = Math.floor((percentage / 100) * length);
  const bar = "█".repeat(filled) + "░".repeat(length - filled);
  return `\`${bar}\` ${percentage}%`;
}

export async function grantXP(
  userId: string,
  guildId: string,
  guild: Guild,
  channel?: TextChannel,
  welcomeConfig?: any
): Promise<void> {
  const key = `${userId}-${guildId}`;
  const now = Date.now();
  if ((xpCooldowns.get(key) ?? 0) + XP_COOLDOWN_MS > now) return;
  xpCooldowns.set(key, now);

  const xpGain = Math.floor(Math.random() * 11) + 15;
  const existing = await db.select().from(levelsTable).where(eq(levelsTable.id, key)).limit(1);
  const current = existing[0] ?? { xp: 0, level: 0, totalMessages: 0 };
  const oldLevel = getLevelFromXP(current.xp);
  const newXP = current.xp + xpGain;
  const newLevel = getLevelFromXP(newXP);

  if (existing[0]) {
    await db.update(levelsTable).set({
      xp: newXP,
      level: newLevel,
      totalMessages: current.totalMessages + 1,
      lastXpAt: new Date(),
    }).where(eq(levelsTable.id, key));
  } else {
    await db.insert(levelsTable).values({
      id: key, userId, guildId,
      xp: newXP, level: newLevel,
      totalMessages: 1, lastXpAt: new Date(),
    });
  }

  if (newLevel > oldLevel) {
    await handleLevelUp(userId, guildId, newLevel, guild, channel, welcomeConfig);
  }
}

async function handleLevelUp(
  userId: string,
  guildId: string,
  level: number,
  guild: Guild,
  channel?: TextChannel,
  welcomeConfig?: any
): Promise<void> {
  const member = guild.members.cache.get(userId);
  if (!member) return;

  const rewards = await db.select().from(levelRewardsTable)
    .where(and(eq(levelRewardsTable.guildId, guildId), eq(levelRewardsTable.level, level)));
  for (const reward of rewards) {
    const role = guild.roles.cache.get(reward.roleId);
    if (role && !member.roles.cache.has(role.id)) {
      await member.roles.add(role, `Nível ${level} alcançado`).catch(() => {});
    }
  }

  if (!welcomeConfig?.levelUpEnabled) return;

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("🎊 Subiu de Nível!")
    .setDescription(`Parabéns ${member}! Você alcançou o **Nível ${level}**!`)
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: "🏆 Nível", value: `**${level}**`, inline: true },
      { name: "⭐ XP Total", value: `**${getXPForLevel(level).toLocaleString("pt-BR")}**`, inline: true },
      ...(rewards.length > 0
        ? [{ name: "🎁 Recompensa", value: rewards.map((r) => `<@&${r.roleId}>`).join(", "), inline: false }]
        : []),
    )
    .setTimestamp();

  const targetChannelId = welcomeConfig?.levelUpChannelId;
  const target = (targetChannelId ? guild.channels.cache.get(targetChannelId) : channel) as TextChannel | undefined;
  await target?.send({ embeds: [embed] }).catch(() => {});
}

export async function getLeaderboard(guildId: string, limit = 10) {
  return db.select().from(levelsTable)
    .where(eq(levelsTable.guildId, guildId))
    .orderBy(desc(levelsTable.xp))
    .limit(limit);
}

export async function getUserLevel(userId: string, guildId: string) {
  const key = `${userId}-${guildId}`;
  const record = await db.select().from(levelsTable).where(eq(levelsTable.id, key)).limit(1);
  return record[0] ?? { xp: 0, level: 0, totalMessages: 0 };
}
