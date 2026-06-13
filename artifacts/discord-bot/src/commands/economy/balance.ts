import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { economyEmbed, formatBalance } from "../../lib/helpers.js";
import { getOrCreateUser } from "../../lib/db.js";

export const data = new SlashCommandBuilder()
  .setName("saldo")
  .setDescription("Veja seu saldo ou o saldo de outro membro")
  .addUserOption((o) => o.setName("usuario").setDescription("Usuário para verificar o saldo").setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const target = interaction.options.getUser("usuario") ?? interaction.user;
  const user = await getOrCreateUser(target.id, interaction.guildId!, target.username);

  const isSelf = target.id === interaction.user.id;

  return interaction.editReply({
    embeds: [
      economyEmbed(
        isSelf ? "Seu Saldo" : `Saldo de ${target.username}`,
        `💰 **Saldo atual:** ${formatBalance(user.balance)}`
      )
        .setThumbnail(target.displayAvatarURL())
        .setFooter({ text: "Use /daily e /missoes para ganhar mais Dólares!" }),
    ],
  });
}
