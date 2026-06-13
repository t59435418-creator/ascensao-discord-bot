import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/helpers.js";
import { getOrCreateUser, addWarning } from "../../lib/db.js";

export const data = new SlashCommandBuilder()
  .setName("avisar")
  .setDescription("Avisa um membro com um motivo")
  .addUserOption((o) => o.setName("usuario").setDescription("Usuário a ser avisado").setRequired(true))
  .addStringOption((o) => o.setName("motivo").setDescription("Motivo do aviso").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Você não tem permissão para avisar membros.")], ephemeral: true });
  }

  const user = interaction.options.getUser("usuario", true);
  const motivo = interaction.options.getString("motivo", true);

  if (user.id === interaction.user.id) {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Você não pode avisar a si mesmo.")], ephemeral: true });
  }

  await getOrCreateUser(user.id, interaction.guildId!, user.username);
  const totalWarns = await addWarning(user.id, interaction.guildId!, interaction.user.id, motivo);

  try {
    await user.send(
      `⚠️ Você recebeu um **aviso** no servidor **${interaction.guild?.name}**.\n📋 Motivo: ${motivo}\n👮 Moderador: ${interaction.user.tag}\n🔢 Total de avisos: ${totalWarns}`
    ).catch(() => {});
  } catch {}

  return interaction.reply({
    embeds: [
      successEmbed("Aviso Emitido", `**${user.tag}** foi avisado.\n📋 **Motivo:** ${motivo}\n🔢 **Total de avisos:** ${totalWarns}`)
        .setThumbnail(user.displayAvatarURL()),
    ],
  });
}
