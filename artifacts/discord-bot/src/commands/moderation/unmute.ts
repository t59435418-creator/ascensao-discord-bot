import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/helpers.js";

export const data = new SlashCommandBuilder()
  .setName("unmute")
  .setDescription("Remove o silêncio de um membro")
  .addUserOption((o) => o.setName("usuario").setDescription("Usuário a remover o mute").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Você não tem permissão.")], ephemeral: true });
  }

  const target = interaction.options.getMember("usuario") as GuildMember | null;
  const user = interaction.options.getUser("usuario", true);

  if (!target) {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Usuário não encontrado.")], ephemeral: true });
  }

  if (!target.isCommunicationDisabled()) {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Este usuário não está silenciado.")], ephemeral: true });
  }

  try {
    await target.timeout(null);
    return interaction.reply({
      embeds: [successEmbed("Mute Removido", `**${user.tag}** pode falar novamente.`).setThumbnail(user.displayAvatarURL())],
    });
  } catch {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Não foi possível remover o mute.")], ephemeral: true });
  }
}
