import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/helpers.js";

export const data = new SlashCommandBuilder()
  .setName("slowmode")
  .setDescription("Define o modo lento de um canal")
  .addIntegerOption((o) =>
    o.setName("segundos").setDescription("Segundos de espera (0 para desativar, máx 21600)").setMinValue(0).setMaxValue(21600).setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Você não tem permissão para gerenciar canais.")], ephemeral: true });
  }

  const segundos = interaction.options.getInteger("segundos", true);
  const channel = interaction.channel as TextChannel;

  try {
    await channel.setRateLimitPerUser(segundos);
    const msg = segundos === 0
      ? "Modo lento **desativado** neste canal."
      : `Modo lento definido para **${segundos} segundo(s)** neste canal.`;
    return interaction.reply({ embeds: [successEmbed("Slowmode", msg)] });
  } catch {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Não foi possível alterar o slowmode.")], ephemeral: true });
  }
}
