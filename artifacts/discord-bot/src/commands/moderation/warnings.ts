import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { infoEmbed, errorEmbed } from "../../lib/helpers.js";
import { getOrCreateUser, getUserWarnings } from "../../lib/db.js";

export const data = new SlashCommandBuilder()
  .setName("avisos")
  .setDescription("Veja os avisos de um membro")
  .addUserOption((o) => o.setName("usuario").setDescription("Usuário para verificar avisos").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser("usuario", true);

  await getOrCreateUser(user.id, interaction.guildId!, user.username);
  const warnings = await getUserWarnings(user.id, interaction.guildId!);

  if (warnings.length === 0) {
    return interaction.reply({
      embeds: [infoEmbed(`📋 Avisos de ${user.tag}`, "Este usuário não tem nenhum aviso.")],
    });
  }

  const list = warnings
    .slice(-10)
    .map((w, i) => `**${i + 1}.** ${w.reason}\n└ <@${w.moderatorId}> — <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`)
    .join("\n\n");

  return interaction.reply({
    embeds: [
      infoEmbed(`📋 Avisos de ${user.tag}`, list, 0xe67e22)
        .addFields({ name: "Total de Avisos", value: `${warnings.length}` })
        .setThumbnail(user.displayAvatarURL()),
    ],
  });
}
