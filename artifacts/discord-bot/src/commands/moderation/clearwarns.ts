import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/helpers.js";
import { getOrCreateUser, clearWarnings } from "../../lib/db.js";

export const data = new SlashCommandBuilder()
  .setName("limpar-avisos")
  .setDescription("Remove todos os avisos de um membro")
  .addUserOption((o) => o.setName("usuario").setDescription("Usuário para limpar avisos").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Apenas administradores podem limpar avisos.")], ephemeral: true });
  }

  const user = interaction.options.getUser("usuario", true);
  await getOrCreateUser(user.id, interaction.guildId!, user.username);
  await clearWarnings(user.id, interaction.guildId!);

  return interaction.reply({
    embeds: [successEmbed("Avisos Limpos", `Todos os avisos de **${user.tag}** foram removidos.`)],
  });
}
