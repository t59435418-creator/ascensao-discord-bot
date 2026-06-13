import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { antiraidConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("antiraid")
  .setDescription("Sistema de proteção anti-raid")
  .addSubcommand((s) =>
    s
      .setName("configurar")
      .setDescription("Configure o anti-raid (Admin)")
      .addBooleanOption((o) => o.setName("ativo").setDescription("Ativar ou desativar o anti-raid").setRequired(true))
      .addIntegerOption((o) =>
        o.setName("limite-entradas").setDescription("Quantas entradas em X segundos para acionar (padrão: 10)").setMinValue(2).setMaxValue(50)
      )
      .addIntegerOption((o) =>
        o.setName("janela-segundos").setDescription("Janela de tempo em segundos (padrão: 10)").setMinValue(5).setMaxValue(60)
      )
      .addStringOption((o) =>
        o
          .setName("acao")
          .setDescription("Ação ao detectar raid")
          .addChoices(
            { name: "Kick (expulsar)", value: "kick" },
            { name: "Ban (banir)", value: "ban" },
            { name: "Quarentena (remover cargos)", value: "quarantine" }
          )
      )
      .addIntegerOption((o) =>
        o.setName("idade-minima-conta").setDescription("Idade mínima da conta em dias (padrão: 7)").setMinValue(0).setMaxValue(365)
      )
      .addChannelOption((o) => o.setName("canal-log").setDescription("Canal para logs do anti-raid"))
  )
  .addSubcommand((s) => s.setName("status").setDescription("Veja o status do anti-raid"))
  .addSubcommand((s) => s.setName("lockdown").setDescription("Ativa o lockdown do servidor (impede entradas temporariamente)"))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Apenas administradores podem gerenciar o anti-raid.")], ephemeral: true });
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "configurar") {
    const ativo = interaction.options.getBoolean("ativo", true);
    const limite = interaction.options.getInteger("limite-entradas") ?? 10;
    const janela = interaction.options.getInteger("janela-segundos") ?? 10;
    const acao = interaction.options.getString("acao") ?? "kick";
    const idadeMinima = interaction.options.getInteger("idade-minima-conta") ?? 7;
    const canalLog = interaction.options.getChannel("canal-log");

    const config = {
      guildId: interaction.guildId!,
      enabled: ativo,
      joinThreshold: limite,
      joinWindowSeconds: janela,
      action: acao,
      minAccountAgeDays: idadeMinima,
      logChannelId: canalLog?.id ?? null,
      updatedAt: new Date(),
    };

    await db.insert(antiraidConfigTable).values(config).onConflictDoUpdate({ target: antiraidConfigTable.guildId, set: config });

    return interaction.reply({
      embeds: [
        successEmbed("Anti-Raid Configurado!", `🛡️ Anti-raid **${ativo ? "ATIVADO" : "DESATIVADO"}**\n\n` +
          `⚡ Detecta **${limite} entradas** em **${janela} segundos**\n` +
          `🔨 Ação: **${acao}**\n` +
          `📅 Idade mínima da conta: **${idadeMinima} dias**${canalLog ? `\n📋 Log em: <#${canalLog.id}>` : ""}`)
      ],
    });
  }

  if (sub === "status") {
    const config = await db.select().from(antiraidConfigTable).where(eq(antiraidConfigTable.guildId, interaction.guildId!)).limit(1);

    if (!config[0]) {
      return interaction.reply({ embeds: [infoEmbed("Anti-Raid", "Não configurado. Use `/antiraid configurar`.")], ephemeral: true });
    }

    const c = config[0];
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(c.enabled ? 0x2ecc71 : 0xe74c3c)
          .setTitle(`🛡️ Anti-Raid — ${c.enabled ? "✅ Ativo" : "❌ Inativo"}`)
          .addFields(
            { name: "Limite de Entradas", value: `${c.joinThreshold} em ${c.joinWindowSeconds}s`, inline: true },
            { name: "Ação", value: c.action, inline: true },
            { name: "Idade Mínima da Conta", value: `${c.minAccountAgeDays} dias`, inline: true },
            { name: "Canal de Log", value: c.logChannelId ? `<#${c.logChannelId}>` : "Não definido", inline: true },
          )
          .setTimestamp(),
      ],
    });
  }

  if (sub === "lockdown") {
    const everyone = interaction.guild!.roles.everyone;
    const channels = interaction.guild!.channels.cache.filter(
      (c) => c.type === 0
    );

    await interaction.deferReply();

    for (const [, channel] of channels) {
      await (channel as any).permissionOverwrites.edit(everyone, { SendMessages: false }).catch(() => {});
    }

    return interaction.editReply({
      embeds: [
        successEmbed("🔒 LOCKDOWN ATIVADO", "Todos os canais foram trancados por segurança.\n\nUse `/trancar trancar:false` em cada canal para reabrir quando seguro.")
          .setColor(0xe74c3c),
      ],
    });
  }
}

function infoEmbed(title: string, desc: string) {
  return new EmbedBuilder().setColor(0x3498db).setTitle(title).setDescription(desc).setTimestamp();
}

const joinTracker = new Map<string, number[]>();

export function trackJoin(guildId: string, memberId: string, member: GuildMember, config: any) {
  if (!config?.enabled) return;

  const key = guildId;
  const now = Date.now();
  const window = (config.joinWindowSeconds ?? 10) * 1000;

  if (!joinTracker.has(key)) joinTracker.set(key, []);
  const timestamps = joinTracker.get(key)!;
  timestamps.push(now);

  const recent = timestamps.filter((t) => now - t < window);
  joinTracker.set(key, recent);

  if (recent.length >= (config.joinThreshold ?? 10)) {
    joinTracker.set(key, []);

    const accountAge = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    if (accountAge < (config.minAccountAgeDays ?? 7)) {
      if (config.action === "kick" && member.kickable) {
        member.kick("Anti-Raid: conta suspeita").catch(() => {});
      } else if (config.action === "ban" && member.bannable) {
        member.ban({ reason: "Anti-Raid: conta suspeita" }).catch(() => {});
      }
    }
  }
}
