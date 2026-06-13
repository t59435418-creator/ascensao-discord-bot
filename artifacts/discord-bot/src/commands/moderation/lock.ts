import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  PermissionsBitField,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/helpers.js";

export const data = new SlashCommandBuilder()
  .setName("trancar")
  .setDescription("Tranca ou abre um canal para @everyone")
  .addBooleanOption((o) => o.setName("trancar").setDescription("true = trancar, false = abrir").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Você não tem permissão para gerenciar canais.")], ephemeral: true });
  }

  const lock = interaction.options.getBoolean("trancar", true);
  const channel = interaction.channel as TextChannel;
  const everyone = interaction.guild!.roles.everyone;

  try {
    await channel.permissionOverwrites.edit(everyone, {
      SendMessages: lock ? false : null,
    });

    if (lock) {
      return interaction.reply({ embeds: [successEmbed("Canal Trancado", `🔒 Este canal foi **trancado**. Ninguém pode enviar mensagens.`)] });
    } else {
      return interaction.reply({ embeds: [successEmbed("Canal Aberto", `🔓 Este canal foi **aberto**. Todos podem enviar mensagens novamente.`)] });
    }
  } catch {
    return interaction.reply({ embeds: [errorEmbed("Erro", "Não foi possível alterar as permissões do canal.")], ephemeral: true });
  }
}
