import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, EmbedBuilder,
} from "discord.js";
import { successEmbed, errorEmbed, brandEmbed } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { welcomeConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("boas-vindas")
  .setDescription("Configure mensagens de boas-vindas e despedida")
  .addSubcommand((s) =>
    s
      .setName("configurar")
      .setDescription("Configura o sistema de boas-vindas (Admin)")
      .addChannelOption((o) => o.setName("canal-entrada").setDescription("Canal de boas-vindas").setRequired(false).addChannelTypes(ChannelType.GuildText))
      .addStringOption((o) => o.setName("mensagem-entrada").setDescription("Mensagem de boas-vindas. Use {user}, {username}, {server}, {memberCount}").setRequired(false))
      .addChannelOption((o) => o.setName("canal-saida").setDescription("Canal de despedida").setRequired(false).addChannelTypes(ChannelType.GuildText))
      .addStringOption((o) => o.setName("mensagem-saida").setDescription("Mensagem de despedida").setRequired(false))
      .addStringOption((o) => o.setName("dm").setDescription("Mensagem no privado ao entrar (deixe vazio para desativar)").setRequired(false))
      .addStringOption((o) =>
        o.setName("entrada-ativada").setDescription("Ativar boas-vindas").setRequired(false)
          .addChoices({ name: "✅ Sim", value: "true" }, { name: "❌ Não", value: "false" })
      )
      .addStringOption((o) =>
        o.setName("saida-ativada").setDescription("Ativar despedida").setRequired(false)
          .addChoices({ name: "✅ Sim", value: "true" }, { name: "❌ Não", value: "false" })
      )
  )
  .addSubcommand((s) => s.setName("ver").setDescription("Veja as configurações atuais"))
  .addSubcommand((s) => s.setName("testar").setDescription("Testa a mensagem de boas-vindas"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "configurar") {
    const canalEntrada = interaction.options.getChannel("canal-entrada");
    const msgEntrada = interaction.options.getString("mensagem-entrada");
    const canalSaida = interaction.options.getChannel("canal-saida");
    const msgSaida = interaction.options.getString("mensagem-saida");
    const dm = interaction.options.getString("dm");
    const entradaAtivada = interaction.options.getString("entrada-ativada");
    const saidaAtivada = interaction.options.getString("saida-ativada");

    const update: any = {};
    if (canalEntrada) update.welcomeChannelId = canalEntrada.id;
    if (msgEntrada) update.welcomeMessage = msgEntrada;
    if (canalSaida) update.goodbyeChannelId = canalSaida.id;
    if (msgSaida) update.goodbyeMessage = msgSaida;
    if (dm !== null) { update.dmWelcome = dm !== ""; if (dm) update.dmMessage = dm; }
    if (entradaAtivada !== null) update.welcomeEnabled = entradaAtivada === "true";
    if (saidaAtivada !== null) update.goodbyeEnabled = saidaAtivada === "true";

    await db.insert(welcomeConfigTable).values({ id: interaction.guildId!, ...update })
      .onConflictDoUpdate({ target: welcomeConfigTable.id, set: update });

    return interaction.reply({ embeds: [successEmbed("Boas-vindas Configurado!", "Configurações salvas com sucesso!\nUse `/boas-vindas testar` para ver um preview.")] });
  }

  if (sub === "ver") {
    const config = await db.select().from(welcomeConfigTable).where(eq(welcomeConfigTable.id, interaction.guildId!)).limit(1);
    const c = config[0];
    if (!c) return interaction.reply({ embeds: [brandEmbed("Boas-vindas", "Nenhuma configuração encontrada. Use `/boas-vindas configurar`.")] });
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🎉 Configurações de Boas-vindas")
      .addFields(
        { name: "📥 Entrada", value: c.welcomeEnabled ? `✅ Ativo em <#${c.welcomeChannelId ?? "não definido"}>` : "❌ Desativado", inline: true },
        { name: "📤 Saída", value: c.goodbyeEnabled ? `✅ Ativo em <#${c.goodbyeChannelId ?? "não definido"}>` : "❌ Desativado", inline: true },
        { name: "📨 DM", value: c.dmWelcome ? "✅ Ativado" : "❌ Desativado", inline: true },
        { name: "💬 Msg. Entrada", value: `\`${c.welcomeMessage}\``, inline: false },
        { name: "💬 Msg. Saída", value: `\`${c.goodbyeMessage}\``, inline: false },
        { name: "📊 Level Up", value: c.levelUpEnabled ? `✅ Ativo${c.levelUpChannelId ? ` em <#${c.levelUpChannelId}>` : " (mesmo canal)"}` : "❌ Desativado", inline: true },
      )
      .setFooter({ text: "Variáveis: {user} {username} {server} {memberCount}" })
      .setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === "testar") {
    const config = await db.select().from(welcomeConfigTable).where(eq(welcomeConfigTable.id, interaction.guildId!)).limit(1);
    const c = config[0];
    const msg = c?.welcomeMessage ?? "Bem-vindo(a) ao servidor, {user}! 🎉";
    const parsed = msg
      .replace("{user}", `${interaction.user}`)
      .replace("{username}", interaction.user.username)
      .replace("{server}", interaction.guild?.name ?? "Servidor")
      .replace("{memberCount}", `${interaction.guild?.memberCount ?? 0}`);
    const embed = new EmbedBuilder()
      .setColor(c?.welcomeColor ?? 0x5865f2)
      .setTitle("🎉 Preview de Boas-vindas")
      .setDescription(parsed)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
      .addFields({ name: "👥 Membros", value: `${interaction.guild?.memberCount ?? 0}`, inline: true })
      .setFooter({ text: `Este é apenas um preview!` })
      .setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

export function formatWelcomeMessage(msg: string, member: any, guild: any): string {
  return msg
    .replace("{user}", `<@${member.user.id}>`)
    .replace("{username}", member.user.username)
    .replace("{server}", guild.name)
    .replace("{memberCount}", `${guild.memberCount}`);
}
