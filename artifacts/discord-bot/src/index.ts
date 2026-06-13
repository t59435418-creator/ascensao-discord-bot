import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Partials,
  Message,
  ButtonInteraction,
  StringSelectMenuInteraction,
  TextChannel,
  EmbedBuilder,
  ActivityType,
  GuildMember,
} from "discord.js";
import { pathToFileURL, fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import http from "http";

import { db } from "./lib/db.js";
import {
  afkTable, antiraidConfigTable, trapChannelsTable,
  welcomeConfigTable, automodConfigTable,
} from "./lib/db.js";
import { eq } from "drizzle-orm";

import { trackJoin } from "./commands/utility/antiraid.js";
import { handleTicketButton } from "./commands/utility/ticket.js";
import { handleGiveawayButton } from "./commands/utility/sorteio.js";
import { handleEventButton } from "./commands/utility/evento.js";
import { handlePollButton } from "./commands/utility/enquete.js";
import { handleReactionRoleButton } from "./commands/utility/cargos-reacao.js";
import { handleStarboard } from "./commands/utility/estrela.js";
import { checkPendingReminders } from "./commands/utility/lembrar.js";
import { formatWelcomeMessage } from "./commands/utility/boas-vindas.js";

import { grantXP } from "./lib/leveling.js";
import { logMember, logMessageDelete, logMessageEdit, logVoice } from "./lib/logging.js";

interface Command {
  data: { name: string; toJSON: () => unknown };
  execute: (interaction: any) => Promise<any>;
}

const PRIVILEGED = process.env.PRIVILEGED_INTENTS_ENABLED === "true";

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.DirectMessages,
  ...(PRIVILEGED
    ? [GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent]
    : []),
];

const client = new Client({
  intents,
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});
const commands = new Collection<string, Command>();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Carregar comandos ────────────────────────────────────────────────────────
for (const folder of ["moderation", "economy", "utility"]) {
  const folderPath = path.join(__dirname, "commands", folder);
  if (!fs.existsSync(folderPath)) continue;
  for (const file of fs
    .readdirSync(folderPath)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"))) {
    const command: Command = await import(
      pathToFileURL(path.join(folderPath, file)).href
    );
    if ("data" in command && "execute" in command) {
      commands.set(command.data.name, command);
      console.log(`✅ Comando carregado: /${command.data.name}`);
    }
  }
}

// ─── Anti-spam em memória ─────────────────────────────────────────────────────
const spamMap = new Map<string, number[]>();

// ─── Status do bot ────────────────────────────────────────────────────────────
const STATUSES = [
  { text: "💵 /daily • ganhe Dólares!", type: ActivityType.Playing },
  { text: "⭐ /nivel • suba de nível!", type: ActivityType.Competing },
  { text: "🎉 /sorteio • crie sorteios!", type: ActivityType.Watching },
  { text: "🛡️ Protegendo o servidor", type: ActivityType.Watching },
  { text: "🤖 /ajuda • todos os comandos", type: ActivityType.Listening },
];
let statusIdx = 0;

// ─── Bot pronto ───────────────────────────────────────────────────────────────
client.once(Events.ClientReady, async (c) => {
  console.log(`🤖 Bot online como ${c.user.tag}`);
  console.log(`📊 Servindo ${c.guilds.cache.size} servidor(es)`);
  console.log(`⚡ ${commands.size} comandos carregados`);
  console.log(`🔑 Privileged intents: ${PRIVILEGED ? "ATIVO" : "INATIVO"}`);

  const setStatus = () => {
    const s = STATUSES[statusIdx % STATUSES.length];
    c.user.setPresence({ activities: [{ name: s.text, type: s.type }], status: "online" });
    statusIdx++;
  };
  setStatus();
  setInterval(setStatus, 30_000);

  // Lembretes pendentes
  await checkPendingReminders(client as any).catch(console.error);
  setInterval(() => checkPendingReminders(client as any).catch(console.error), 60_000);
});

// ─── Mensagens ────────────────────────────────────────────────────────────────
client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot || !message.guild) return;

  // ── Canal Armadilha ──────────────────────────────────────────────────────
  const trapId = `${message.guild.id}-${message.channel.id}`;
  const trap = await db
    .select()
    .from(trapChannelsTable)
    .where(eq(trapChannelsTable.id, trapId))
    .limit(1)
    .catch(() => []);
  if (trap[0]) {
    const isImage =
      message.attachments.size > 0 ||
      /\.(png|jpg|jpeg|gif|webp|mp4|mov|bmp|svg)/i.test(message.content);
    const action = isImage ? trap[0].actionImage : trap[0].actionMessage;
    const member = message.guild.members.cache.get(message.author.id);
    await message.delete().catch(() => {});
    const dmMsg = isImage
      ? `🚫 Você enviou uma **imagem/anexo** em um canal proibido no servidor **${message.guild.name}** e foi **${action === "ban" ? "banido" : "expulso"}** automaticamente.`
      : `🚫 Você enviou uma **mensagem** em um canal proibido no servidor **${message.guild.name}** e foi **${action === "ban" ? "banido" : "expulso"}** automaticamente.`;
    await message.author.send(dmMsg).catch(() => {});
    if (action === "ban" && member?.bannable)
      await member.ban({ reason: "Canal Armadilha" }).catch(() => {});
    else if (action === "kick" && member?.kickable)
      await member.kick("Canal Armadilha").catch(() => {});
    return;
  }

  // ── Auto-Mod ─────────────────────────────────────────────────────────────
  const automodConfig = await db
    .select()
    .from(automodConfigTable)
    .where(eq(automodConfigTable.id, message.guild.id))
    .limit(1)
    .catch(() => []);
  if (automodConfig[0]?.enabled && PRIVILEGED) {
    const cfg = automodConfig[0];
    const member = message.guild.members.cache.get(message.author.id);
    const ignoredRoles = cfg.ignoredRoles ? cfg.ignoredRoles.split(",") : [];
    const ignoredChannels = cfg.ignoredChannels ? cfg.ignoredChannels.split(",") : [];
    const isIgnored =
      ignoredChannels.includes(message.channel.id) ||
      (member && ignoredRoles.some((r) => member.roles.cache.has(r)));

    if (!isIgnored) {
      let violated = false;
      let reason = "";

      // Anti-Spam
      if (cfg.antiSpamEnabled) {
        const key = `${message.guild.id}-${message.author.id}`;
        const now = Date.now();
        const timestamps = (spamMap.get(key) ?? []).filter(
          (t) => now - t < cfg.antiSpamSeconds * 1000
        );
        timestamps.push(now);
        spamMap.set(key, timestamps);
        if (timestamps.length >= cfg.antiSpamThreshold) {
          violated = true;
          reason = "Anti-Spam";
          spamMap.delete(key);
        }
      }

      // Anti-Links
      if (!violated && cfg.antiLinkEnabled) {
        const urlRegex = /https?:\/\/[^\s]+/gi;
        const links = message.content.match(urlRegex);
        if (links) {
          const allowed = cfg.allowedDomains ? cfg.allowedDomains.split(",").map((d) => d.trim()) : [];
          const hasBlocked = links.some(
            (url) => !allowed.some((domain) => url.includes(domain))
          );
          if (hasBlocked) { violated = true; reason = "Anti-Links"; }
        }
      }

      // Bad Words
      if (!violated && cfg.badWordsEnabled && cfg.badWords) {
        const words = cfg.badWords.split(",").map((w) => w.trim().toLowerCase());
        const content = message.content.toLowerCase();
        if (words.some((w) => content.includes(w))) {
          violated = true;
          reason = "Palavras Proibidas";
        }
      }

      // Anti-Mention Spam
      if (!violated && cfg.antiMentionEnabled) {
        const mentionCount = message.mentions.users.size + message.mentions.roles.size;
        if (mentionCount >= cfg.mentionThreshold) {
          violated = true;
          reason = "Spam de Menções";
        }
      }

      if (violated) {
        await message.delete().catch(() => {});
        const warn = await message.channel
          .send(`⚠️ ${message.author}, sua mensagem foi removida: **${reason}**.`)
          .catch(() => null);
        if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);

        if (cfg.action === "timeout" && member?.moderatable) {
          await member
            .timeout(30_000, `Auto-Mod: ${reason}`)
            .catch(() => {});
        }
        return;
      }
    }
  }

  // ── XP ───────────────────────────────────────────────────────────────────
  if (PRIVILEGED) {
    const welcomeCfg = await db
      .select()
      .from(welcomeConfigTable)
      .where(eq(welcomeConfigTable.id, message.guild.id))
      .limit(1)
      .catch(() => []);
    await grantXP(
      message.author.id,
      message.guild.id,
      message.guild,
      message.channel as TextChannel,
      welcomeCfg[0]
    ).catch(() => {});
  }

  // ── AFK: remover do autor ────────────────────────────────────────────────
  if (PRIVILEGED) {
    const authorKey = `${message.author.id}-${message.guild.id}`;
    const authorAfk = await db
      .select()
      .from(afkTable)
      .where(eq(afkTable.id, authorKey))
      .limit(1)
      .catch(() => []);
    if (authorAfk.length > 0) {
      await db.delete(afkTable).where(eq(afkTable.id, authorKey)).catch(() => {});
      const reply = await message
        .reply(`👋 Bem-vindo de volta, **${message.author.username}**! Seu AFK foi removido.`)
        .catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => {}), 7000);
    }

    // ── AFK: notificar ao mencionar ─────────────────────────────────────────
    for (const [, user] of message.mentions.users) {
      if (user.bot || user.id === message.author.id) continue;
      const key = `${user.id}-${message.guild.id}`;
      const afkRecord = await db
        .select()
        .from(afkTable)
        .where(eq(afkTable.id, key))
        .limit(1)
        .catch(() => []);
      if (afkRecord.length > 0) {
        const elapsed = Math.floor(
          (Date.now() - afkRecord[0].setAt.getTime()) / 60000
        );
        const timeStr =
          elapsed < 60
            ? `${elapsed} minuto(s)`
            : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`;
        const reply = await message
          .reply(
            `⚠️ **${user.username}** está AFK há **${timeStr}**.\n📋 Motivo: **${afkRecord[0].motivo}**`
          )
          .catch(() => null);
        if (reply) setTimeout(() => reply.delete().catch(() => {}), 7000);
      }
    }
  }

  // ── Prefixo "+" ─────────────────────────────────────────────────────────
  if (PRIVILEGED && message.content.startsWith("+")) {
    const args = message.content.slice(1).trim().split(/\s+/);
    const cmdName = args.shift()?.toLowerCase();
    if (!cmdName) return;
    const prefixCmds: Record<string, string> = {
      ranking: "ranking", saldo: "saldo", ping: "ping", daily: "daily",
      missoes: "missoes", sorteio: "sorteio", ajuda: "ajuda",
      serverinfo: "serverinfo", avatar: "avatar", nivel: "nivel",
      perfil: "perfil", rep: "rep", lembrar: "lembrar", enquete: "enquete",
    };
    if (prefixCmds[cmdName]) {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription(
          `💡 Para usar este comando, digite **/${prefixCmds[cmdName]}** no chat!\nDigite **/** para ver todos os comandos disponíveis.`
        )
        .setFooter({ text: "O Discord usa slash commands (/) para bots" });
      const reply = await message.reply({ embeds: [embed] }).catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => {}), 10000);
    }
  }
});

// ─── Log: mensagem editada ────────────────────────────────────────────────────
client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
  if (!newMsg.guild || newMsg.author?.bot) return;
  await logMessageEdit(newMsg.guild, oldMsg, newMsg).catch(() => {});
});

// ─── Log: mensagem deletada ───────────────────────────────────────────────────
client.on(Events.MessageDelete, async (message) => {
  if (!message.guild || message.author?.bot) return;
  await logMessageDelete(message.guild, message).catch(() => {});
});

// ─── Log: voice state ─────────────────────────────────────────────────────────
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (!newState.guild) return;
  await logVoice(
    newState.guild,
    newState.member ?? oldState.member,
    oldState.channelId,
    newState.channelId
  ).catch(() => {});
});

// ─── Anti-Raid + Boas-vindas ─────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
  try {
    const [antiraidCfg, welcomeCfg] = await Promise.all([
      db.select().from(antiraidConfigTable).where(eq(antiraidConfigTable.guildId, member.guild.id)).limit(1),
      db.select().from(welcomeConfigTable).where(eq(welcomeConfigTable.id, member.guild.id)).limit(1),
    ]);

    if (antiraidCfg[0]?.enabled) {
      trackJoin(member.guild.id, member.id, member as any, antiraidCfg[0]);
    }

    const wc = welcomeCfg[0];
    if (wc?.welcomeEnabled && wc.welcomeChannelId) {
      const channel = member.guild.channels.cache.get(wc.welcomeChannelId) as TextChannel;
      if (channel) {
        const msg = formatWelcomeMessage(wc.welcomeMessage, member, member.guild);
        const embed = new EmbedBuilder()
          .setColor(wc.welcomeColor)
          .setTitle("🎉 Novo Membro!")
          .setDescription(msg)
          .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
          .addFields({ name: "👥 Membros", value: `${member.guild.memberCount}`, inline: true })
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      }
    }

    if (wc?.dmWelcome && wc.dmMessage) {
      const dmMsg = formatWelcomeMessage(wc.dmMessage, member, member.guild);
      const dmEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`👋 Bem-vindo(a) ao ${member.guild.name}!`)
        .setDescription(dmMsg)
        .setThumbnail(member.guild.iconURL({ size: 64 }) ?? null)
        .setTimestamp();
      await member.user.send({ embeds: [dmEmbed] }).catch(() => {});
    }

    await logMember(member.guild, member, true);
  } catch {}
});

// ─── Despedida + Log ─────────────────────────────────────────────────────────
client.on(Events.GuildMemberRemove, async (member) => {
  try {
    const welcomeCfg = await db
      .select()
      .from(welcomeConfigTable)
      .where(eq(welcomeConfigTable.id, member.guild.id))
      .limit(1);
    const wc = welcomeCfg[0];
    if (wc?.goodbyeEnabled && wc.goodbyeChannelId) {
      const channel = member.guild.channels.cache.get(wc.goodbyeChannelId) as TextChannel;
      if (channel) {
        const msg = (wc.goodbyeMessage ?? "**{username}** saiu do servidor. 👋")
          .replace("{user}", `<@${member.user.id}>`)
          .replace("{username}", member.user.username)
          .replace("{server}", member.guild.name)
          .replace("{memberCount}", `${member.guild.memberCount}`);
        const embed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("👋 Membro Saiu")
          .setDescription(msg)
          .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
          .addFields({ name: "👥 Membros", value: `${member.guild.memberCount}`, inline: true })
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      }
    }
    await logMember(member.guild, member, false);
  } catch {}
});

// ─── Starboard ────────────────────────────────────────────────────────────────
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot || !reaction.message.guild) return;
  if (reaction.emoji.name !== "⭐") return;
  if (reaction.partial) await reaction.fetch().catch(() => {});
  const message = reaction.message;
  if (!message.guild || !message.author) return;
  await handleStarboard(
    message.guild.id,
    message.id,
    message.channelId,
    message.author.id,
    message.content ?? "",
    reaction.count ?? 1,
    client
  ).catch(() => {});
});

// ─── Interações ───────────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  // ── Botões ──────────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const btn = interaction as ButtonInteraction;
    const id = btn.customId;
    if (["ticket_open", "ticket_close_btn", "ticket_delete", "ticket_reopen"].includes(id)) {
      return handleTicketButton(btn).catch(console.error);
    }
    if (id.startsWith("giveaway_enter_")) return handleGiveawayButton(btn).catch(console.error);
    if (id.startsWith("event_join_") || id.startsWith("event_leave_")) return handleEventButton(btn).catch(console.error);
    if (id.startsWith("poll_vote_")) return handlePollButton(btn).catch(console.error);
    if (id.startsWith("reactionrole_")) return handleReactionRoleButton(btn).catch(console.error);
    return;
  }

  // ── Slash Commands ───────────────────────────────────────────────────────
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Erro ao executar /${interaction.commandName}:`, error);
    const msg = { content: "❌ Ocorreu um erro ao executar este comando.", ephemeral: true };
    if (interaction.replied || interaction.deferred)
      await interaction.followUp(msg).catch(() => {});
    else await interaction.reply(msg).catch(() => {});
  }
});

// ─── Reconexão automática ─────────────────────────────────────────────────────
client.on(Events.Error, (err) => {
  console.error("⚠️ [Discord.js Error]", err.message);
});

client.on(Events.Warn, (info) => {
  console.warn("⚠️ [Discord.js Warn]", info);
});

client.on(Events.ShardDisconnect, (event, shardId) => {
  console.warn(`🔌 Shard ${shardId} desconectou (código ${event.code}). Reconectando...`);
});

client.on(Events.ShardReconnecting, (shardId) => {
  console.log(`🔄 Shard ${shardId} reconectando...`);
});

client.on(Events.ShardResume, (shardId, replayedEvents) => {
  console.log(`✅ Shard ${shardId} reconectado. Eventos recuperados: ${replayedEvents}`);
});

// ─── Proteção contra crashes ──────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("🚨 [uncaughtException]", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("🚨 [unhandledRejection]", reason);
});

// ─── Servidor HTTP keep-alive ─────────────────────────────────────────────────
const startTime = new Date();

const healthServer = http.createServer((req, res) => {
  const uptime = Math.floor((Date.now() - startTime.getTime()) / 1000);
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = uptime % 60;

  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "online",
        bot: client.user?.tag ?? "conectando...",
        guilds: client.guilds.cache.size,
        commands: commands.size,
        uptime: `${h}h ${m}m ${s}s`,
        ping: client.ws.ping,
        timestamp: new Date().toISOString(),
      })
    );
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

// Tenta portas sequencialmente até encontrar uma livre
const PORTS_TO_TRY = [4000, 4001, 4002, 4003, 4004];

function tryListen(ports: number[]) {
  const port = ports[0];
  if (!port) {
    console.warn("⚠️ Nenhuma porta disponível para o servidor keep-alive.");
    return;
  }
  healthServer.listen(port, () => {
    console.log(`🌐 Servidor keep-alive ativo na porta ${port}`);
    console.log(`🔗 Acesse /health para verificar o status do bot`);
  });
  healthServer.once("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`⚠️ Porta ${port} ocupada, tentando ${ports[1]}...`);
      healthServer.removeAllListeners("error");
      tryListen(ports.slice(1));
    } else {
      console.error("Erro no servidor keep-alive:", err);
    }
  });
}

tryListen(PORTS_TO_TRY);

// ─── Login ────────────────────────────────────────────────────────────────────
const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("DISCORD_TOKEN não está definido!");

async function startBot() {
  try {
    await client.login(token!);
  } catch (err) {
    console.error("❌ Falha ao conectar. Tentando novamente em 10s...", err);
    setTimeout(startBot, 10_000);
  }
}

startBot();
