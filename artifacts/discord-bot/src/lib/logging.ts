import { Guild, EmbedBuilder, TextChannel, ColorResolvable } from "discord.js";
import { db } from "./db.js";
import { logsConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const configCache = new Map<string, any>();

async function getConfig(guildId: string) {
  if (configCache.has(guildId)) return configCache.get(guildId);
  const config = await db.select().from(logsConfigTable).where(eq(logsConfigTable.id, guildId)).limit(1).catch(() => []);
  const result = config[0] ?? null;
  configCache.set(guildId, result);
  setTimeout(() => configCache.delete(guildId), 30_000);
  return result;
}

export function invalidateConfig(guildId: string) {
  configCache.delete(guildId);
}

async function sendLog(guild: Guild, channelId: string | null | undefined, embed: EmbedBuilder) {
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
  await channel?.send({ embeds: [embed] }).catch(() => {});
}

function logEmbed(color: ColorResolvable, title: string) {
  return new EmbedBuilder().setColor(color).setTitle(title).setTimestamp();
}

export async function logMod(guild: Guild, title: string, fields: { name: string; value: string; inline?: boolean }[]) {
  const config = await getConfig(guild.id);
  if (!config?.modLogChannel || !config.enabled) return;
  const embed = logEmbed(0xe74c3c, `🛡️ ${title}`).addFields(fields);
  await sendLog(guild, config.modLogChannel, embed);
}

export async function logMember(guild: Guild, member: any, joined: boolean) {
  const config = await getConfig(guild.id);
  if (!config?.memberLogChannel || !config.enabled) return;
  const embed = joined
    ? logEmbed(0x2ecc71, "📥 Membro Entrou")
        .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
        .addFields(
          { name: "👤 Membro", value: `${member} (${member.user.tag})`, inline: true },
          { name: "🆔 ID", value: member.user.id, inline: true },
          { name: "📅 Conta criada", value: `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>`, inline: true },
          { name: "👥 Membros", value: `${guild.memberCount}`, inline: true },
        )
    : logEmbed(0xe74c3c, "📤 Membro Saiu")
        .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
        .addFields(
          { name: "👤 Membro", value: `${member.user.tag}`, inline: true },
          { name: "🆔 ID", value: member.user.id, inline: true },
          { name: "📅 Entrou em", value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : "Desconhecido", inline: true },
          { name: "👥 Membros", value: `${guild.memberCount}`, inline: true },
        );
  await sendLog(guild, config.memberLogChannel, embed);
}

export async function logMessageDelete(guild: Guild, message: any) {
  const config = await getConfig(guild.id);
  if (!config?.messageLogChannel || !config.enabled) return;
  if (message.author?.bot) return;
  const embed = logEmbed(0xe67e22, "🗑️ Mensagem Deletada")
    .addFields(
      { name: "👤 Autor", value: `${message.author ?? "Desconhecido"}`, inline: true },
      { name: "📍 Canal", value: `<#${message.channelId}>`, inline: true },
      { name: "📝 Conteúdo", value: message.content ? (message.content.length > 1000 ? message.content.slice(0, 1000) + "..." : message.content) : "*(sem texto)*", inline: false },
    );
  if (message.attachments?.size > 0) embed.addFields({ name: "📎 Anexos", value: `${message.attachments.size} arquivo(s)`, inline: true });
  await sendLog(guild, config.messageLogChannel, embed);
}

export async function logMessageEdit(guild: Guild, oldMsg: any, newMsg: any) {
  const config = await getConfig(guild.id);
  if (!config?.messageLogChannel || !config.enabled) return;
  if (newMsg.author?.bot) return;
  if (oldMsg.content === newMsg.content) return;
  const embed = logEmbed(0x3498db, "✏️ Mensagem Editada")
    .addFields(
      { name: "👤 Autor", value: `${newMsg.author}`, inline: true },
      { name: "📍 Canal", value: `<#${newMsg.channelId}>`, inline: true },
      { name: "📝 Antes", value: oldMsg.content ? (oldMsg.content.length > 500 ? oldMsg.content.slice(0, 500) + "..." : oldMsg.content) : "*(sem texto)*", inline: false },
      { name: "📝 Depois", value: newMsg.content ? (newMsg.content.length > 500 ? newMsg.content.slice(0, 500) + "..." : newMsg.content) : "*(sem texto)*", inline: false },
      { name: "🔗 Ir para", value: `[Clique aqui](${newMsg.url})`, inline: true },
    );
  await sendLog(guild, config.messageLogChannel, embed);
}

export async function logVoice(guild: Guild, member: any, oldChannelId: string | null, newChannelId: string | null) {
  const config = await getConfig(guild.id);
  if (!config?.voiceLogChannel || !config.enabled) return;

  let title = "", color: ColorResolvable = 0x9b59b6, desc = "";
  if (!oldChannelId && newChannelId) {
    title = "🔊 Entrou no Voice"; color = 0x2ecc71;
    desc = `${member} entrou em <#${newChannelId}>`;
  } else if (oldChannelId && !newChannelId) {
    title = "🔇 Saiu do Voice"; color = 0xe74c3c;
    desc = `${member} saiu de <#${oldChannelId}>`;
  } else if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
    title = "🔀 Movido no Voice"; color = 0xf39c12;
    desc = `${member} foi de <#${oldChannelId}> para <#${newChannelId}>`;
  } else return;

  const embed = logEmbed(color, title).setDescription(desc).addFields(
    { name: "👤 Membro", value: `${member.user.tag}`, inline: true },
    { name: "🆔 ID", value: member.user.id, inline: true },
  );
  await sendLog(guild, config.voiceLogChannel, embed);
}
