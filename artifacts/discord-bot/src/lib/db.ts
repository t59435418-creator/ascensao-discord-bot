export { db } from "@workspace/db";
export {
  usersTable, missionsTable, warningsTable, transactionsTable,
  afkTable, ticketConfigTable, ticketsTable, ratingsTable,
  partnershipConfigTable, antiraidConfigTable,
  trapChannelsTable, giveawaysTable, eventsTable,
  levelsTable, levelRewardsTable, welcomeConfigTable, logsConfigTable,
  pollsTable, starboardConfigTable, starboardEntriesTable,
  automodConfigTable, reactionRolePanelsTable, remindersTable, reputationTable,
} from "@workspace/db";

import { db } from "@workspace/db";
import {
  usersTable, missionsTable, warningsTable, transactionsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function getOrCreateUser(userId: string, guildId: string, username: string) {
  const key = `${userId}-${guildId}`;
  const existing = await db.select().from(usersTable).where(eq(usersTable.id, key)).limit(1);
  if (existing.length > 0) {
    if (existing[0].username !== username) {
      await db.update(usersTable).set({ username, updatedAt: new Date() }).where(eq(usersTable.id, key));
    }
    return existing[0];
  }
  const newUser = { id: key, guildId, username, balance: 0, warnings: 0, isMuted: false };
  await db.insert(usersTable).values(newUser);
  return { ...newUser, lastDaily: null, lastMissions: null, muteUntil: null, createdAt: new Date(), updatedAt: new Date() };
}

export async function addBalance(userId: string, guildId: string, amount: number, type: string, description: string) {
  const key = `${userId}-${guildId}`;
  const user = await db.select().from(usersTable).where(eq(usersTable.id, key)).limit(1);
  const currentBalance = user[0]?.balance ?? 0;
  const newBalance = Math.max(0, currentBalance + amount);
  await db.update(usersTable).set({ balance: newBalance, updatedAt: new Date() }).where(eq(usersTable.id, key));
  await db.insert(transactionsTable).values({ id: randomUUID(), userId: key, guildId, amount, type, description });
  return newBalance;
}

export async function updateLastDaily(userId: string, guildId: string) {
  const key = `${userId}-${guildId}`;
  await db.update(usersTable).set({ lastDaily: new Date(), updatedAt: new Date() }).where(eq(usersTable.id, key));
}

export async function addWarning(userId: string, guildId: string, moderatorId: string, reason: string) {
  const key = `${userId}-${guildId}`;
  await db.insert(warningsTable).values({ id: randomUUID(), userId: key, guildId, moderatorId, reason });
  const user = await db.select().from(usersTable).where(eq(usersTable.id, key)).limit(1);
  const newWarnings = (user[0]?.warnings ?? 0) + 1;
  await db.update(usersTable).set({ warnings: newWarnings, updatedAt: new Date() }).where(eq(usersTable.id, key));
  return newWarnings;
}

export async function getUserWarnings(userId: string, guildId: string) {
  const key = `${userId}-${guildId}`;
  return db.select().from(warningsTable).where(eq(warningsTable.userId, key));
}

export async function clearWarnings(userId: string, guildId: string) {
  const key = `${userId}-${guildId}`;
  await db.update(usersTable).set({ warnings: 0, updatedAt: new Date() }).where(eq(usersTable.id, key));
}

export async function getOrCreateMissions(userId: string, guildId: string, username: string) {
  const today = new Date().toISOString().split("T")[0];
  const key = `${userId}-${guildId}`;
  const missionId = `${key}-${today}`;
  const existing = await db.select().from(missionsTable).where(eq(missionsTable.id, missionId)).limit(1);
  if (existing.length > 0) return existing[0];

  const missionTypes = [
    "chat", "react", "voice", "mention", "invite", "meme",
    "compliment", "question", "game", "help", "art", "music",
  ];
  const shuffled = [...missionTypes].sort(() => Math.random() - 0.5).slice(0, 3);
  const reward = () => Math.floor(Math.random() * (1000 - 250 + 1)) + 250;
  const newMission = {
    id: missionId, userId: key, guildId, missionDate: today,
    mission1Type: shuffled[0], mission2Type: shuffled[1], mission3Type: shuffled[2],
    mission1Reward: reward(), mission2Reward: reward(), mission3Reward: reward(),
    mission1Completed: false, mission2Completed: false, mission3Completed: false,
  };
  await db.insert(missionsTable).values(newMission);
  return newMission;
}

export async function completeMission(userId: string, guildId: string, missionNumber: 1 | 2 | 3) {
  const today = new Date().toISOString().split("T")[0];
  const key = `${userId}-${guildId}`;
  const missionId = `${key}-${today}`;
  const missions = await db.select().from(missionsTable).where(eq(missionsTable.id, missionId)).limit(1);
  if (!missions[0]) return null;
  const mission = missions[0];
  const fieldCompleted = `mission${missionNumber}Completed` as keyof typeof mission;
  const fieldReward = `mission${missionNumber}Reward` as keyof typeof mission;
  if (mission[fieldCompleted]) return null;
  const reward = mission[fieldReward] as number;
  await db.update(missionsTable).set({ [fieldCompleted]: true } as any).where(eq(missionsTable.id, missionId));
  return reward;
}

export async function getTopUsers(guildId: string, limit = 10) {
  return db.select().from(usersTable).where(eq(usersTable.guildId, guildId)).orderBy(desc(usersTable.balance)).limit(limit);
}
