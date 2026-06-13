import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { db } from "../../lib/db.js";
import { usersTable, reputationTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUserLevel, getXPProgress, makeProgressBar } from "../../lib/leveling.js";

export const data = new SlashCommandBuilder()
  .setName("perfil")
  .setDescription("Veja seu perfil completo ou de outro membro")
  .addUserOption((o) => o.setName("membro").setDescription("Membro para ver").setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser("membro") ?? interaction.user;
  const key = `${target.id}-${interaction.guildId}`;

  const [userRecord, levelRecord, repRecord] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, key)).limit(1),
    getUserLevel(target.id, interaction.guildId!),
    db.select().from(reputationTable).where(eq(reputationTable.id, key)).limit(1),
  ]);

  const user = userRecord[0];
  const rep = repRecord[0]?.reputation ?? 0;
  const { level, currentXP, neededXP, percentage } = getXPProgress(levelRecord.xp);

  const badges: string[] = [];
  if ((user?.balance ?? 0) >= 1_000_000) badges.push("💰");
  if (level >= 50) badges.push("🏆");
  else if (level >= 25) badges.push("🌟");
  else if (level >= 10) badges.push("⭐");
  if (rep >= 50) badges.push("🤝");
  if ((user?.warnings ?? 0) === 0) badges.push("😇");

  const accountAge = Math.floor((Date.now() - target.createdAt.getTime()) / (1000 * 60 * 60 * 24));

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${badges.join(" ")} Perfil de ${target.username}`)
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .setDescription(badges.length > 0 ? `**Conquistas:** ${badges.join(" ")}` : "*Sem conquistas ainda — continue ativo!*")
    .addFields(
      {
        name: "⭐ Nível & XP",
        value: `Nível **${level}** · ${levelRecord.xp.toLocaleString("pt-BR")} XP total\n${makeProgressBar(percentage, 14)} → Nível ${level + 1}`,
        inline: false,
      },
      { name: "💵 Saldo", value: `**$${(user?.balance ?? 0).toLocaleString("pt-BR")}** Dólares`, inline: true },
      { name: "⭐ Reputação", value: `**+${rep}** pontos`, inline: true },
      { name: "💬 Mensagens", value: `**${levelRecord.totalMessages.toLocaleString("pt-BR")}**`, inline: true },
      { name: "⚠️ Avisos", value: `**${user?.warnings ?? 0}**`, inline: true },
      { name: "📅 Conta criada", value: `há **${accountAge}** dias`, inline: true },
    )
    .setFooter({ text: `ID: ${target.id}` })
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
