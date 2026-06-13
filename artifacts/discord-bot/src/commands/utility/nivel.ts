import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, ChannelType,
} from "discord.js";
import { successEmbed, errorEmbed, brandEmbed, makeProgressBar } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { levelRewardsTable, welcomeConfigTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getUserLevel, getLeaderboard, getLevelFromXP, getXPForLevel, getXPProgress, makeProgressBar as pb } from "../../lib/leveling.js";
import { randomUUID } from "crypto";

export const data = new SlashCommandBuilder()
  .setName("nivel")
  .setDescription("Sistema de XP e níveis")
  .addSubcommand((s) => s.setName("ver").setDescription("Veja seu nível e XP").addUserOption((o) => o.setName("membro").setDescription("Membro para ver").setRequired(false)))
  .addSubcommand((s) => s.setName("ranking").setDescription("Top 10 por XP do servidor"))
  .addSubcommand((s) =>
    s
      .setName("recompensa-add")
      .setDescription("Adiciona cargo de recompensa por nível (Admin)")
      .addIntegerOption((o) => o.setName("nivel").setDescription("Nível necessário").setRequired(true).setMinValue(1))
      .addRoleOption((o) => o.setName("cargo").setDescription("Cargo a ser dado").setRequired(true))
  )
  .addSubcommand((s) =>
    s
      .setName("recompensa-remover")
      .setDescription("Remove cargo de recompensa (Admin)")
      .addIntegerOption((o) => o.setName("nivel").setDescription("Nível").setRequired(true))
  )
  .addSubcommand((s) => s.setName("recompensas").setDescription("Lista todos os cargos de recompensa"))
  .addSubcommand((s) =>
    s
      .setName("canal-levelup")
      .setDescription("Define canal para anúncios de level up (Admin)")
      .addChannelOption((o) => o.setName("canal").setDescription("Canal ou deixe vazio para usar o canal da mensagem").setRequired(false).addChannelTypes(ChannelType.GuildText))
      .addStringOption((o) => o.setName("ativado").setDescription("Ativar ou desativar anúncios").setRequired(false).addChoices({ name: "✅ Ativar", value: "true" }, { name: "❌ Desativar", value: "false" }))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "ver") {
    const target = interaction.options.getUser("membro") ?? interaction.user;
    const data = await getUserLevel(target.id, interaction.guildId!);
    const { level, currentXP, neededXP, percentage } = getXPProgress(data.xp);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`⭐ Nível de ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: "🏆 Nível", value: `**${level}**`, inline: true },
        { name: "💎 XP Total", value: `**${data.xp.toLocaleString("pt-BR")}**`, inline: true },
        { name: "💬 Mensagens", value: `**${data.totalMessages.toLocaleString("pt-BR")}**`, inline: true },
        { name: `📈 Progresso para Nível ${level + 1}`, value: `${pb(percentage)}\n${currentXP.toLocaleString("pt-BR")} / ${neededXP.toLocaleString("pt-BR")} XP`, inline: false },
      )
      .setFooter({ text: `Ganhe XP enviando mensagens! (1 XP por minuto, 15-25 por mensagem)` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "ranking") {
    const top = await getLeaderboard(interaction.guildId!);
    if (top.length === 0) return interaction.reply({ embeds: [errorEmbed("Ranking Vazio", "Nenhum membro com XP ainda.")], ephemeral: true });

    const medals = ["🥇", "🥈", "🥉"];
    const rows = top.map((u, i) => {
      const { level } = getXPProgress(u.xp);
      const medal = medals[i] ?? `**${i + 1}.**`;
      return `${medal} <@${u.userId}> — Nível **${level}** · **${u.xp.toLocaleString("pt-BR")}** XP`;
    });

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle("🏆 Top 10 — Ranking de Níveis")
          .setDescription(rows.join("\n"))
          .setTimestamp(),
      ],
    });
  }

  if (sub === "recompensa-add") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Apenas administradores.")], ephemeral: true });
    }
    const nivel = interaction.options.getInteger("nivel", true);
    const cargo = interaction.options.getRole("cargo", true);
    const id = `${interaction.guildId}-${nivel}-${cargo.id}`;
    await db.insert(levelRewardsTable).values({ id, guildId: interaction.guildId!, level: nivel, roleId: cargo.id }).onConflictDoNothing();
    return interaction.reply({ embeds: [successEmbed("Recompensa Adicionada", `${cargo} será dado ao atingir o **Nível ${nivel}**!`)] });
  }

  if (sub === "recompensa-remover") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Apenas administradores.")], ephemeral: true });
    }
    const nivel = interaction.options.getInteger("nivel", true);
    await db.delete(levelRewardsTable).where(and(eq(levelRewardsTable.guildId, interaction.guildId!), eq(levelRewardsTable.level, nivel)));
    return interaction.reply({ embeds: [successEmbed("Recompensa Removida", `Recompensa do Nível ${nivel} removida.`)] });
  }

  if (sub === "recompensas") {
    const rewards = await db.select().from(levelRewardsTable).where(eq(levelRewardsTable.guildId, interaction.guildId!));
    if (rewards.length === 0) return interaction.reply({ embeds: [brandEmbed("🎁 Recompensas de Nível", "Nenhuma recompensa configurada ainda.\nUse `/nivel recompensa-add` para adicionar.")] });
    const sorted = rewards.sort((a, b) => a.level - b.level);
    const list = sorted.map((r) => `**Nível ${r.level}** → <@&${r.roleId}>`).join("\n");
    return interaction.reply({ embeds: [brandEmbed("🎁 Recompensas de Nível", list)] });
  }

  if (sub === "canal-levelup") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Apenas administradores.")], ephemeral: true });
    }
    const canal = interaction.options.getChannel("canal");
    const ativado = interaction.options.getString("ativado");
    const update: any = {};
    if (canal) update.levelUpChannelId = canal.id;
    if (ativado !== null) update.levelUpEnabled = ativado === "true";
    await db.insert(welcomeConfigTable).values({ id: interaction.guildId!, ...update })
      .onConflictDoUpdate({ target: welcomeConfigTable.id, set: update });
    return interaction.reply({ embeds: [successEmbed("Level Up Configurado", `Canal de anúncios atualizado!`)] });
  }
}
