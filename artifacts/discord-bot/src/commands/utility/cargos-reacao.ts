import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction, TextChannel, ChannelType, Role,
} from "discord.js";
import { successEmbed, errorEmbed, brandEmbed } from "../../lib/helpers.js";
import { db } from "../../lib/db.js";
import { reactionRolePanelsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

const BUTTON_STYLES = [ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success, ButtonStyle.Danger];

export const data = new SlashCommandBuilder()
  .setName("cargos-reacao")
  .setDescription("Crie painéis de cargos interativos com botões")
  .addSubcommand((s) =>
    s
      .setName("criar")
      .setDescription("Cria um painel de cargos por botão (Admin)")
      .addStringOption((o) => o.setName("titulo").setDescription("Título do painel").setRequired(true))
      .addRoleOption((o) => o.setName("cargo1").setDescription("Cargo 1").setRequired(true))
      .addStringOption((o) => o.setName("emoji1").setDescription("Emoji do cargo 1").setRequired(false))
      .addRoleOption((o) => o.setName("cargo2").setDescription("Cargo 2").setRequired(false))
      .addStringOption((o) => o.setName("emoji2").setDescription("Emoji do cargo 2").setRequired(false))
      .addRoleOption((o) => o.setName("cargo3").setDescription("Cargo 3").setRequired(false))
      .addStringOption((o) => o.setName("emoji3").setDescription("Emoji do cargo 3").setRequired(false))
      .addRoleOption((o) => o.setName("cargo4").setDescription("Cargo 4").setRequired(false))
      .addStringOption((o) => o.setName("emoji4").setDescription("Emoji do cargo 4").setRequired(false))
      .addRoleOption((o) => o.setName("cargo5").setDescription("Cargo 5").setRequired(false))
      .addStringOption((o) => o.setName("emoji5").setDescription("Emoji do cargo 5").setRequired(false))
      .addChannelOption((o) => o.setName("canal").setDescription("Canal para enviar o painel").setRequired(false).addChannelTypes(ChannelType.GuildText))
  )
  .addSubcommand((s) =>
    s
      .setName("remover")
      .setDescription("Remove um painel de cargos")
      .addStringOption((o) => o.setName("id").setDescription("ID do painel").setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "criar") {
    const titulo = interaction.options.getString("titulo", true);
    const descricao = interaction.options.getString("descricao") ?? "Clique nos botões abaixo para obter ou remover cargos!";
    const canal = (interaction.options.getChannel("canal") ?? interaction.channel) as TextChannel;

    const buttons: { roleId: string; roleName: string; emoji?: string }[] = [];
    for (let i = 1; i <= 5; i++) {
      const cargo = interaction.options.getRole(`cargo${i}`);
      if (!cargo) continue;
      const emoji = interaction.options.getString(`emoji${i}`) ?? undefined;
      buttons.push({ roleId: cargo.id, roleName: cargo.name, emoji });
    }

    if (buttons.length === 0) return interaction.reply({ embeds: [errorEmbed("Erro", "Adicione pelo menos 1 cargo.")], ephemeral: true });

    const id = randomUUID().slice(0, 8).toUpperCase();
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🎭 ${titulo}`)
      .setDescription(descricao)
      .addFields(buttons.map((b) => ({ name: `${b.emoji ?? "🔘"} ${b.roleName}`, value: `<@&${b.roleId}>`, inline: true })))
      .setFooter({ text: `ID: ${id} • Clique para obter/remover o cargo` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      buttons.map((b, idx) => {
        const btn = new ButtonBuilder()
          .setCustomId(`reactionrole_${id}_${b.roleId}`)
          .setLabel(b.roleName.slice(0, 80))
          .setStyle(BUTTON_STYLES[idx % BUTTON_STYLES.length]);
        if (b.emoji) btn.setEmoji(b.emoji);
        return btn;
      })
    );

    await interaction.deferReply({ ephemeral: true });
    const msg = await canal.send({ embeds: [embed], components: [row] });

    await db.insert(reactionRolePanelsTable).values({
      id,
      guildId: interaction.guildId!,
      channelId: canal.id,
      messageId: msg.id,
      title: titulo,
      description: descricao,
      buttons: JSON.stringify(buttons),
    });

    return interaction.editReply({ embeds: [successEmbed("Painel Criado!", `🎭 Painel **${titulo}** criado em <#${canal.id}>!\n🆔 ID: \`${id}\``)] });
  }

  if (sub === "remover") {
    const id = interaction.options.getString("id", true).toUpperCase();
    const panel = await db.select().from(reactionRolePanelsTable)
      .where(and(eq(reactionRolePanelsTable.id, id), eq(reactionRolePanelsTable.guildId, interaction.guildId!))).limit(1);
    if (!panel[0]) return interaction.reply({ embeds: [errorEmbed("Erro", "Painel não encontrado.")], ephemeral: true });

    const channel = interaction.guild?.channels.cache.get(panel[0].channelId) as TextChannel;
    if (channel && panel[0].messageId) {
      const msg = await channel.messages.fetch(panel[0].messageId).catch(() => null);
      await msg?.delete().catch(() => {});
    }
    await db.delete(reactionRolePanelsTable).where(eq(reactionRolePanelsTable.id, id));
    return interaction.reply({ embeds: [successEmbed("Painel Removido", `Painel \`${id}\` removido.`)], ephemeral: true });
  }
}

export async function handleReactionRoleButton(interaction: ButtonInteraction) {
  const parts = interaction.customId.split("_");
  const roleId = parts[2];
  const member = interaction.member as any;
  if (!member) return;

  const role = interaction.guild?.roles.cache.get(roleId);
  if (!role) return interaction.reply({ content: "❌ Cargo não encontrado!", ephemeral: true });

  const hasRole = member.roles?.cache?.has(roleId);
  if (hasRole) {
    await member.roles.remove(role, "Cargo por reação — removido").catch(() => {});
    return interaction.reply({ content: `❌ Cargo **${role.name}** removido!`, ephemeral: true });
  } else {
    await member.roles.add(role, "Cargo por reação — adicionado").catch(() => {});
    return interaction.reply({ content: `✅ Cargo **${role.name}** adicionado!`, ephemeral: true });
  }
}
