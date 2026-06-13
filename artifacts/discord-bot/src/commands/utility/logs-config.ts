import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, EmbedBuilder,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { logsConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { invalidateConfig } from "../../lib/logging.js";

export const data = new SlashCommandBuilder()
  .setName("logs")
  .setDescription("Configure os canais de log do servidor")
  .addSubcommand((s) =>
    s
      .setName("configurar")
      .setDescription("Define os canais de log (Admin)")
      .addChannelOption((o) => o.setName("moderacao").setDescription("Canal de logs de moderação").setRequired(false).addChannelTypes(ChannelType.GuildText))
      .addChannelOption((o) => o.setName("membros").setDescription("Canal de logs de entradas e saídas").setRequired(false).addChannelTypes(ChannelType.GuildText))
      .addChannelOption((o) => o.setName("mensagens").setDescription("Canal de logs de mensagens editadas/deletadas").setRequired(false).addChannelTypes(ChannelType.GuildText))
      .addChannelOption((o) => o.setName("voice").setDescription("Canal de logs de voice").setRequired(false).addChannelTypes(ChannelType.GuildText))
      .addStringOption((o) => o.setName("ativado").setDescription("Ativar ou desativar todos os logs").setRequired(false).addChoices({ name: "✅ Ativar", value: "true" }, { name: "❌ Desativar", value: "false" }))
  )
  .addSubcommand((s) => s.setName("ver").setDescription("Veja as configurações de log atuais"))
  .addSubcommand((s) => s.setName("desativar").setDescription("Desativa todos os logs"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "configurar") {
    const mod = interaction.options.getChannel("moderacao");
    const membros = interaction.options.getChannel("membros");
    const msgs = interaction.options.getChannel("mensagens");
    const voice = interaction.options.getChannel("voice");
    const ativado = interaction.options.getString("ativado");

    const update: any = {};
    if (mod) update.modLogChannel = mod.id;
    if (membros) update.memberLogChannel = membros.id;
    if (msgs) update.messageLogChannel = msgs.id;
    if (voice) update.voiceLogChannel = voice.id;
    if (ativado !== null) update.enabled = ativado === "true";

    await db.insert(logsConfigTable).values({ id: interaction.guildId!, ...update })
      .onConflictDoUpdate({ target: logsConfigTable.id, set: update });
    invalidateConfig(interaction.guildId!);

    const lines = [
      mod ? `🛡️ Moderação: <#${mod.id}>` : null,
      membros ? `👥 Membros: <#${membros.id}>` : null,
      msgs ? `💬 Mensagens: <#${msgs.id}>` : null,
      voice ? `🔊 Voice: <#${voice.id}>` : null,
      ativado !== null ? `⚡ Status: ${ativado === "true" ? "✅ Ativado" : "❌ Desativado"}` : null,
    ].filter(Boolean);

    return interaction.reply({ embeds: [successEmbed("Logs Configurados!", lines.join("\n") || "Nenhuma alteração feita.")] });
  }

  if (sub === "ver") {
    const config = await db.select().from(logsConfigTable).where(eq(logsConfigTable.id, interaction.guildId!)).limit(1);
    const c = config[0];
    if (!c) return interaction.reply({ embeds: [errorEmbed("Não Configurado", "Use `/logs configurar` para definir os canais de log.")] });
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📋 Configurações de Logs")
      .addFields(
        { name: "⚡ Status", value: c.enabled ? "✅ Ativado" : "❌ Desativado", inline: false },
        { name: "🛡️ Moderação", value: c.modLogChannel ? `<#${c.modLogChannel}>` : "Não definido", inline: true },
        { name: "👥 Membros", value: c.memberLogChannel ? `<#${c.memberLogChannel}>` : "Não definido", inline: true },
        { name: "💬 Mensagens", value: c.messageLogChannel ? `<#${c.messageLogChannel}>` : "Não definido", inline: true },
        { name: "🔊 Voice", value: c.voiceLogChannel ? `<#${c.voiceLogChannel}>` : "Não definido", inline: true },
      )
      .setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === "desativar") {
    await db.insert(logsConfigTable).values({ id: interaction.guildId!, enabled: false })
      .onConflictDoUpdate({ target: logsConfigTable.id, set: { enabled: false } });
    invalidateConfig(interaction.guildId!);
    return interaction.reply({ embeds: [successEmbed("Logs Desativados", "Todos os logs foram desativados.")] });
  }
}
