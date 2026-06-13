import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { economyEmbed, errorEmbed, formatBalance } from "../../lib/helpers.js";
import { getOrCreateUser, addBalance } from "../../lib/db.js";

export const data = new SlashCommandBuilder()
  .setName("adicionar-dinheiro")
  .setDescription("Adiciona Dólares a um usuário (apenas administradores)")
  .addUserOption((o) => o.setName("usuario").setDescription("Usuário que receberá os Dólares").setRequired(true))
  .addIntegerOption((o) => o.setName("quantidade").setDescription("Quantidade de Dólares a adicionar").setMinValue(1).setRequired(true))
  .addStringOption((o) => o.setName("motivo").setDescription("Motivo da adição").setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Apenas administradores podem adicionar Dólares.")], ephemeral: true });
  }

  const target = interaction.options.getUser("usuario", true);
  const quantidade = interaction.options.getInteger("quantidade", true);
  const motivo = interaction.options.getString("motivo") ?? "Adicionado por administrador";

  await getOrCreateUser(target.id, interaction.guildId!, target.username);
  const newBalance = await addBalance(target.id, interaction.guildId!, quantidade, "admin_add", motivo);

  return interaction.reply({
    embeds: [
      economyEmbed("Dólares Adicionados!", `👤 **Usuário:** ${target.tag}\n💵 **Adicionado:** ${formatBalance(quantidade)}\n💰 **Novo saldo:** ${formatBalance(newBalance)}\n📋 **Motivo:** ${motivo}`)
        .setThumbnail(target.displayAvatarURL()),
    ],
  });
}
