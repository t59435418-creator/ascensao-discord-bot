import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { formatBalance } from "../../lib/helpers.js";
import { getTopUsers } from "../../lib/db.js";
import { db, usersTable } from "../../lib/db.js";
import { eq, desc } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("ranking")
  .setDescription("Veja o ranking dos mais ricos do servidor");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const topUsers = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.guildId, interaction.guildId!))
    .orderBy(desc(usersTable.balance))
    .limit(10);

  if (topUsers.length === 0) {
    return interaction.editReply({ content: "Nenhum usuário com saldo ainda! Use `/daily` para começar." });
  }

  const medals = ["🥇", "🥈", "🥉"];
  const list = topUsers
    .map((u, i) => {
      const medal = medals[i] ?? `**${i + 1}.**`;
      const displayName = u.username;
      return `${medal} **${displayName}** — ${formatBalance(u.balance)}`;
    })
    .join("\n");

  return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("🏆 Ranking de Dólares")
        .setDescription(list)
        .setFooter({ text: `${interaction.guild?.name} • Use /daily e /missoes para subir no ranking!` })
        .setTimestamp(),
    ],
  });
}
