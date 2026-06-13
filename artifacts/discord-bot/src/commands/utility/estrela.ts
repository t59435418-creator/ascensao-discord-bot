import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, TextChannel, ChannelType,
} from "discord.js";
import { successEmbed, errorEmbed, brandEmbed } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { starboardConfigTable, starboardEntriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("estrela")
  .setDescription("Configure o canal de melhores mensagens (Starboard)")
  .addSubcommand((s) =>
    s
      .setName("configurar")
      .setDescription("Configura o starboard (Admin)")
      .addChannelOption((o) => o.setName("canal").setDescription("Canal do starboard").setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addIntegerOption((o) => o.setName("estrelas").setDescription("Quantidade de ⭐ para aparecer (padrão: 3)").setRequired(false).setMinValue(1).setMaxValue(20))
      .addStringOption((o) => o.setName("ativado").setDescription("Ativar/desativar").setRequired(false).addChoices({ name: "✅ Ativar", value: "true" }, { name: "❌ Desativar", value: "false" }))
  )
  .addSubcommand((s) => s.setName("ver").setDescription("Veja as configurações do starboard"))
  .addSubcommand((s) => s.setName("top").setDescription("Top 10 mensagens com mais estrelas"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "configurar") {
    const canal = interaction.options.getChannel("canal", true);
    const estrelas = interaction.options.getInteger("estrelas") ?? 3;
    const ativado = interaction.options.getString("ativado");
    const update: any = { channelId: canal.id, threshold: estrelas };
    if (ativado !== null) update.enabled = ativado === "true";

    await db.insert(starboardConfigTable).values({ id: interaction.guildId!, ...update })
      .onConflictDoUpdate({ target: starboardConfigTable.id, set: update });

    return interaction.reply({ embeds: [successEmbed("Starboard Configurado!", `⭐ Canal: <#${canal.id}>\n🌟 Mínimo de estrelas: **${estrelas}**`)] });
  }

  if (sub === "ver") {
    const config = await db.select().from(starboardConfigTable).where(eq(starboardConfigTable.id, interaction.guildId!)).limit(1);
    const c = config[0];
    if (!c) return interaction.reply({ embeds: [brandEmbed("⭐ Starboard", "Não configurado. Use `/estrela configurar`.")], ephemeral: true });
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("⭐ Configurações do Starboard")
      .addFields(
        { name: "📡 Status", value: c.enabled ? "✅ Ativo" : "❌ Inativo", inline: true },
        { name: "📍 Canal", value: `<#${c.channelId}>`, inline: true },
        { name: "⭐ Mínimo", value: `${c.threshold} estrelas`, inline: true },
      )
      .setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === "top") {
    const entries = await db.select().from(starboardEntriesTable)
      .where(eq(starboardEntriesTable.guildId, interaction.guildId!));
    const sorted = entries.sort((a, b) => b.starCount - a.starCount).slice(0, 10);
    if (sorted.length === 0) return interaction.reply({ embeds: [brandEmbed("⭐ Starboard", "Nenhuma mensagem estrelada ainda.")], ephemeral: true });
    const list = sorted.map((e, i) => `**${i + 1}.** ⭐ ${e.starCount} — <@${e.authorId}>\n↳ ${e.content.slice(0, 60)}...`).join("\n\n");
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle("⭐ Top Mensagens").setDescription(list).setTimestamp()] });
  }
}

export async function handleStarboard(guildId: string, messageId: string, channelId: string, authorId: string, content: string, starCount: number, client: any) {
  const config = await db.select().from(starboardConfigTable).where(eq(starboardConfigTable.id, guildId)).limit(1);
  if (!config[0] || !config[0].enabled) return;
  if (starCount < config[0].threshold) return;

  const existing = await db.select().from(starboardEntriesTable)
    .where(and(eq(starboardEntriesTable.guildId, guildId), eq(starboardEntriesTable.originalMessageId, messageId))).limit(1);

  const starChannel = client.channels?.cache?.get(config[0].channelId) as TextChannel | undefined;
  if (!starChannel) return;

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setAuthor({ name: `⭐ ${starCount} estrelas` })
    .setDescription(content.slice(0, 2000) || "*(mensagem sem texto)*")
    .addFields(
      { name: "📍 Canal", value: `<#${channelId}>`, inline: true },
      { name: "👤 Autor", value: `<@${authorId}>`, inline: true },
    )
    .setFooter({ text: `ID: ${messageId}` })
    .setTimestamp();

  if (existing[0]?.starboardMessageId) {
    const starMsg = await starChannel.messages.fetch(existing[0].starboardMessageId).catch(() => null);
    await starMsg?.edit({ embeds: [embed] }).catch(() => {});
    await db.update(starboardEntriesTable).set({ starCount }).where(eq(starboardEntriesTable.originalMessageId, messageId));
  } else {
    const sent = await starChannel.send({ embeds: [embed] }).catch(() => null);
    await db.insert(starboardEntriesTable).values({
      id: `${guildId}-${messageId}`,
      guildId, originalMessageId: messageId,
      starboardMessageId: sent?.id,
      authorId, channelId, starCount, content: content.slice(0, 500),
    }).onConflictDoNothing();
  }
}
