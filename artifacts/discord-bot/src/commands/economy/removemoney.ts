import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { economyEmbed, errorEmbed, formatBalance } from "../../lib/helpers.js";
import { getOrCreateUser, addBalance } from "../../lib/db.js";

export const data = new SlashCommandBuilder()
  .setName("remover-dinheiro")
  .setDescription("Remove Dólares de um usuário (apenas administradores)")
  .addUserOption((o) => o.setName("usuario").setDescription("Usuário alvo").setRequired(true))
  .addIntegerOption((o) => o.setName("quantidade").setDescription("Quantidade a remover").setMinValue(1).setRequired(true))
  .addStringOption((o) => o.setName("motivo").setDescription("Motivo da remoção").setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Apenas administradores podem remover Dólares.")], ephemeral: true });
  }

  const target = interaction.options.getUser("usuario", true);
  const quantidade = interaction.options.getInteger("quantidade", true);
  const motivo = interaction.options.getString("motivo") ?? "Removido por administrador";

  await getOrCreateUser(target.id, interaction.guildId!, target.username);
  const newBalance = await addBalance(target.id, interaction.guildId!, -quantidade, "admin_remove", motivo);

  return interaction.reply({
    embeds: [
      economyEmbed("Dólares Removidos", `👤 **Usuário:** ${target.tag}\n💵 **Removido:** ${formatBalance(quantidade)}\n💰 **Novo saldo:** ${formatBalance(newBalance)}\n📋 **Motivo:** ${motivo}`)
        .setThumbnail(target.displayAvatarURL()),
    ],
  });
}
