import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/helpers.js";

export const data = new SlashCommandBuilder()
  .setName("purgar")
  .setDescription("Deleta várias mensagens de uma vez")
  .addIntegerOption((o) =>
    o.setName("quantidade").setDescription("Quantidade de mensagens (1-100)").setMinValue(1).setMaxValue(100).setRequired(true)
  )
  .addUserOption((o) => o.setName("usuario").setDescription("Filtrar mensagens de um usuário específico").setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
    return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Você não tem permissão para deletar mensagens.")], ephemeral: true });
  }

  const quantidade = interaction.options.getInteger("quantidade", true);
  const usuario = interaction.options.getUser("usuario");
  const channel = interaction.channel as TextChannel;

  await interaction.deferReply({ ephemeral: true });

  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    let toDelete = [...messages.values()].filter((m) => {
      const ageMs = Date.now() - m.createdTimestamp;
      return ageMs < 14 * 24 * 60 * 60 * 1000;
    });

    if (usuario) {
      toDelete = toDelete.filter((m) => m.author.id === usuario.id);
    }

    toDelete = toDelete.slice(0, quantidade);

    const deleted = await channel.bulkDelete(toDelete, true);

    return interaction.editReply({
      embeds: [successEmbed("Mensagens Deletadas", `${deleted.size} mensagem(ns) foram deletadas com sucesso.`)],
    });
  } catch {
    return interaction.editReply({ embeds: [errorEmbed("Erro", "Não foi possível deletar as mensagens. Mensagens mais antigas que 14 dias não podem ser deletadas.")] });
  }
}
