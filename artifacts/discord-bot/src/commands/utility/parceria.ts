import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { successEmbed, errorEmbed, infoEmbed } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { partnershipConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEFAULT_TEMPLATE = `🤝 **PARCERIA**

**{server_name}**
{server_description}

🔗 **Link:** {invite_link}
👥 **Membros:** {member_count}

> Clique no link acima para entrar!`;

export const data = new SlashCommandBuilder()
  .setName("parceria")
  .setDescription("Sistema de parcerias automáticas")
  .addSubcommand((s) =>
    s
      .setName("configurar")
      .setDescription("Configure o canal e cargo de parceria (Admin)")
      .addChannelOption((o) => o.setName("canal").setDescription("Canal onde as parcerias serão enviadas").setRequired(true))
      .addRoleOption((o) => o.setName("cargo").setDescription("Cargo necessário para fazer parcerias").setRequired(false))
      .addStringOption((o) =>
        o
          .setName("template")
          .setDescription("Template personalizado (use {server_name}, {invite_link}, {member_count}, {server_description})")
          .setRequired(false)
      )
  )
  .addSubcommand((s) =>
    s
      .setName("enviar")
      .setDescription("Envia uma parceria no canal configurado")
      .addStringOption((o) => o.setName("invite").setDescription("Link de convite do servidor parceiro").setRequired(true))
      .addStringOption((o) => o.setName("descricao").setDescription("Descrição do servidor parceiro").setRequired(true))
      .addStringOption((o) => o.setName("nome-servidor").setDescription("Nome do servidor parceiro").setRequired(true))
      .addIntegerOption((o) => o.setName("membros").setDescription("Quantidade de membros do servidor parceiro").setRequired(false))
  )
  .addSubcommand((s) => s.setName("ver-config").setDescription("Veja a configuração atual de parceria"));

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "configurar") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [errorEmbed("Sem Permissão", "Apenas administradores podem configurar parcerias.")], ephemeral: true });
    }

    const canal = interaction.options.getChannel("canal", true);
    const cargo = interaction.options.getRole("cargo");
    const template = interaction.options.getString("template") ?? DEFAULT_TEMPLATE;

    const config = {
      guildId: interaction.guildId!,
      channelId: canal.id,
      roleId: cargo?.id ?? null,
      template,
      updatedAt: new Date(),
    };

    await db.insert(partnershipConfigTable).values(config).onConflictDoUpdate({ target: partnershipConfigTable.guildId, set: config });

    return interaction.reply({
      embeds: [
        successEmbed("Parceria Configurada!", `📢 **Canal de parceria:** <#${canal.id}>${cargo ? `\n🎭 **Cargo necessário:** <@&${cargo.id}>` : ""}\n\n✅ Use \`/parceria enviar\` para fazer uma parceria!`),
      ],
      ephemeral: true,
    });
  }

  if (sub === "enviar") {
    const config = await db.select().from(partnershipConfigTable).where(eq(partnershipConfigTable.guildId, interaction.guildId!)).limit(1);

    if (!config[0]?.channelId) {
      return interaction.reply({ embeds: [errorEmbed("Não Configurado", "Configure o canal de parceria com `/parceria configurar`.")], ephemeral: true });
    }

    if (config[0].roleId) {
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      const hasRole = member?.roles.cache.has(config[0].roleId);
      if (!hasRole && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ embeds: [errorEmbed("Sem Permissão", `Você precisa do cargo <@&${config[0].roleId}> para fazer parcerias.`)], ephemeral: true });
      }
    }

    const invite = interaction.options.getString("invite", true);
    const descricao = interaction.options.getString("descricao", true);
    const nomeServidor = interaction.options.getString("nome-servidor", true);
    const membros = interaction.options.getInteger("membros") ?? 0;

    const template = (config[0].template ?? DEFAULT_TEMPLATE)
      .replace(/{server_name}/g, nomeServidor)
      .replace(/{server_description}/g, descricao)
      .replace(/{invite_link}/g, invite)
      .replace(/{member_count}/g, membros.toLocaleString("pt-BR"))
      .replace(/{parceiro}/g, interaction.user.tag);

    const channel = interaction.guild?.channels.cache.get(config[0].channelId) as TextChannel;
    if (!channel) {
      return interaction.reply({ embeds: [errorEmbed("Erro", "Canal de parceria não encontrado.")], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setDescription(template)
      .setFooter({ text: `Parceria feita por ${interaction.user.tag}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    return interaction.reply({ embeds: [successEmbed("Parceria Enviada!", `Sua parceria foi publicada em <#${channel.id}>!`)], ephemeral: true });
  }

  if (sub === "ver-config") {
    const config = await db.select().from(partnershipConfigTable).where(eq(partnershipConfigTable.guildId, interaction.guildId!)).limit(1);
    if (!config[0]) {
      return interaction.reply({ embeds: [infoEmbed("Parceria", "Não configurado. Use `/parceria configurar`.")], ephemeral: true });
    }
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle("🤝 Configuração de Parceria")
          .addFields(
            { name: "Canal", value: config[0].channelId ? `<#${config[0].channelId}>` : "Não definido", inline: true },
            { name: "Cargo Necessário", value: config[0].roleId ? `<@&${config[0].roleId}>` : "Qualquer um", inline: true },
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}
