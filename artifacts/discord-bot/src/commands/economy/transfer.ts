import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { economyEmbed, errorEmbed, formatBalance } from "../../lib/helpers.js";
import { getOrCreateUser, addBalance } from "../../lib/db.js";

export const data = new SlashCommandBuilder()
  .setName("transferir")
  .setDescription("Transfira Dólares para outro membro")
  .addUserOption((o) => o.setName("usuario").setDescription("Usuário que vai receber os Dólares").setRequired(true))
  .addIntegerOption((o) => o.setName("quantidade").setDescription("Quantidade de Dólares a transferir").setMinValue(1).setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const target = interaction.options.getUser("usuario", true);
  const quantidade = interaction.options.getInteger("quantidade", true);

  if (target.id === interaction.user.id) {
    return interaction.editReply({ embeds: [errorEmbed("Erro", "Você não pode transferir para si mesmo.")] });
  }
  if (target.bot) {
    return interaction.editReply({ embeds: [errorEmbed("Erro", "Você não pode transferir para bots.")] });
  }

  const sender = await getOrCreateUser(interaction.user.id, interaction.guildId!, interaction.user.username);

  if (sender.balance < quantidade) {
    return interaction.editReply({
      embeds: [errorEmbed("Saldo Insuficiente", `Você tem apenas ${formatBalance(sender.balance)} e tentou enviar ${formatBalance(quantidade)}.`)],
    });
  }

  await getOrCreateUser(target.id, interaction.guildId!, target.username);
  await addBalance(interaction.user.id, interaction.guildId!, -quantidade, "transfer_out", `Transferência para ${target.username}`);
  const newReceiverBalance = await addBalance(target.id, interaction.guildId!, quantidade, "transfer_in", `Transferência de ${interaction.user.username}`);

  return interaction.editReply({
    embeds: [
      economyEmbed("Transferência Realizada! 💸", `💸 **${interaction.user.username}** transferiu ${formatBalance(quantidade)} para **${target.username}**!\n\n💰 **Novo saldo de ${target.username}:** ${formatBalance(newReceiverBalance)}`)
        .setThumbnail(target.displayAvatarURL()),
    ],
  });
}
