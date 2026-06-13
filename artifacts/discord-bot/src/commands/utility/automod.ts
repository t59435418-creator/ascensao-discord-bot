import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder,
} from "discord.js";
import { successEmbed, errorEmbed, brandEmbed } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { automodConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("automod")
  .setDescription("Configure a moderação automática do servidor")
  .addSubcommand((s) =>
    s
      .setName("configurar")
      .setDescription("Configura o auto-mod (Admin)")
      .addStringOption((o) => o.setName("ativado").setDescription("Ativar/desativar o auto-mod").setRequired(false).addChoices({ name: "✅ Ativar", value: "true" }, { name: "❌ Desativar", value: "false" }))
      .addStringOption((o) => o.setName("anti-spam").setDescription("Ativar anti-spam").setRequired(false).addChoices({ name: "✅ Sim", value: "true" }, { name: "❌ Não", value: "false" }))
      .addIntegerOption((o) => o.setName("spam-limite").setDescription("Máx. mensagens por intervalo (padrão: 5)").setRequired(false).setMinValue(2).setMaxValue(20))
      .addStringOption((o) => o.setName("anti-links").setDescription("Bloquear links externos").setRequired(false).addChoices({ name: "✅ Sim", value: "true" }, { name: "❌ Não", value: "false" }))
      .addStringOption((o) => o.setName("dominios-permitidos").setDescription("Domínios permitidos separados por vírgula (ex: youtube.com,imgur.com)").setRequired(false))
      .addStringOption((o) => o.setName("anti-palavras").setDescription("Ativar filtro de palavras").setRequired(false).addChoices({ name: "✅ Sim", value: "true" }, { name: "❌ Não", value: "false" }))
      .addStringOption((o) => o.setName("palavras-bloqueadas").setDescription("Palavras bloqueadas separadas por vírgula").setRequired(false))
      .addStringOption((o) => o.setName("anti-mencoes").setDescription("Bloquear mention spam").setRequired(false).addChoices({ name: "✅ Sim", value: "true" }, { name: "❌ Não", value: "false" }))
      .addIntegerOption((o) => o.setName("mencoes-limite").setDescription("Máx. menções por mensagem (padrão: 5)").setRequired(false).setMinValue(1).setMaxValue(20))
      .addStringOption((o) => o.setName("acao").setDescription("Ação ao detectar infração").setRequired(false).addChoices({ name: "🗑️ Deletar mensagem", value: "delete" }, { name: "🦶 Deletar + Avisar", value: "warn" }, { name: "⏱️ Deletar + Timeout", value: "timeout" }))
  )
  .addSubcommand((s) => s.setName("ver").setDescription("Veja as configurações do auto-mod"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "configurar") {
    const update: any = {};
    const ativado = interaction.options.getString("ativado");
    const antiSpam = interaction.options.getString("anti-spam");
    const spamLimite = interaction.options.getInteger("spam-limite");
    const antiLinks = interaction.options.getString("anti-links");
    const dominios = interaction.options.getString("dominios-permitidos");
    const antiPalavras = interaction.options.getString("anti-palavras");
    const palavras = interaction.options.getString("palavras-bloqueadas");
    const antiMencoes = interaction.options.getString("anti-mencoes");
    const mencoesLimite = interaction.options.getInteger("mencoes-limite");
    const acao = interaction.options.getString("acao");

    if (ativado !== null) update.enabled = ativado === "true";
    if (antiSpam !== null) update.antiSpamEnabled = antiSpam === "true";
    if (spamLimite !== null) update.antiSpamThreshold = spamLimite;
    if (antiLinks !== null) update.antiLinkEnabled = antiLinks === "true";
    if (dominios !== null) update.allowedDomains = dominios;
    if (antiPalavras !== null) update.badWordsEnabled = antiPalavras === "true";
    if (palavras !== null) update.badWords = palavras;
    if (antiMencoes !== null) update.antiMentionEnabled = antiMencoes === "true";
    if (mencoesLimite !== null) update.mentionThreshold = mencoesLimite;
    if (acao !== null) update.action = acao;

    await db.insert(automodConfigTable).values({ id: interaction.guildId!, ...update })
      .onConflictDoUpdate({ target: automodConfigTable.id, set: update });

    return interaction.reply({ embeds: [successEmbed("Auto-Mod Configurado!", "Configurações salvas. Use `/automod ver` para conferir.")] });
  }

  if (sub === "ver") {
    const config = await db.select().from(automodConfigTable).where(eq(automodConfigTable.id, interaction.guildId!)).limit(1);
    const c = config[0];
    if (!c) return interaction.reply({ embeds: [brandEmbed("🤖 Auto-Mod", "Nenhuma configuração. Use `/automod configurar`.")], ephemeral: true });

    const acaoLabel: Record<string, string> = { delete: "🗑️ Deletar", warn: "⚠️ Deletar + Avisar", timeout: "⏱️ Deletar + Timeout" };
    const embed = new EmbedBuilder()
      .setColor(c.enabled ? 0x57f287 : 0xed4245)
      .setTitle(`🤖 Auto-Mod — ${c.enabled ? "✅ ATIVO" : "❌ INATIVO"}`)
      .addFields(
        { name: "🔁 Anti-Spam", value: `${c.antiSpamEnabled ? "✅" : "❌"} Limite: **${c.antiSpamThreshold}** msgs/${c.antiSpamSeconds}s`, inline: true },
        { name: "🔗 Anti-Links", value: `${c.antiLinkEnabled ? "✅" : "❌"}${c.allowedDomains ? `\nPermitidos: \`${c.allowedDomains.slice(0, 50)}\`` : ""}`, inline: true },
        { name: "🤬 Palavras", value: c.badWordsEnabled ? `✅ ${c.badWords ? `\`${c.badWords.slice(0, 40)}...\`` : "Lista vazia"}` : "❌", inline: true },
        { name: "📣 Anti-Menções", value: `${c.antiMentionEnabled ? "✅" : "❌"} Máx: **${c.mentionThreshold}** menções`, inline: true },
        { name: "⚡ Ação", value: acaoLabel[c.action] ?? c.action, inline: true },
      )
      .setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
