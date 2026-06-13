import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction,
  ComponentType,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ajuda")
  .setDescription("Veja todos os comandos disponíveis organizados por categoria");

const CATEGORIES: Record<string, { emoji: string; label: string; description: string; commands: string[] }> = {
  moderation: {
    emoji: "🛡️", label: "Moderação", description: "Ferramentas para manter o servidor seguro",
    commands: [
      "`/ban` — Bane um membro do servidor",
      "`/kick` — Expulsa um membro",
      "`/mute` — Aplica timeout em um membro",
      "`/unmute` — Remove o timeout",
      "`/avisar` — Emite um aviso oficial",
      "`/avisos` — Veja o histórico de avisos",
      "`/limpar-avisos` — Remove todos os avisos (Admin)",
      "`/purgar` — Deleta mensagens em massa",
      "`/slowmode` — Modo lento no canal",
      "`/trancar` — Tranca/abre o canal",
      "`/canal-armadilha configurar` — Canal que bane/expulsa ao enviar msg",
      "`/canal-armadilha remover/listar` — Gerenciar armadilhas",
      "`/automod configurar` — Moderação automática (spam, links, palavras)",
    ],
  },
  economy: {
    emoji: "💵", label: "Economia", description: "Sistema de Dólares — ganhe, gaste e suba no ranking",
    commands: [
      "`/daily` — Bônus diário de 3.000–5.000 Dólares",
      "`/missoes ver` — Suas missões diárias",
      "`/missoes completar` — Complete uma missão",
      "`/saldo` — Veja seu saldo atual",
      "`/transferir` — Envie Dólares para alguém",
      "`/ranking` — Top 10 mais ricos",
      "`/adicionar-dinheiro` — (Admin) Adicionar Dólares",
      "`/remover-dinheiro` — (Admin) Remover Dólares",
    ],
  },
  levels: {
    emoji: "⭐", label: "Níveis & XP", description: "Suba de nível enviando mensagens e ganhe recompensas",
    commands: [
      "`/nivel ver` — Veja seu nível e barra de progresso",
      "`/nivel ver @membro` — Veja o nível de outro membro",
      "`/nivel ranking` — Top 10 por XP",
      "`/nivel recompensa-add` — (Admin) Cargo por nível",
      "`/nivel recompensas` — Lista recompensas configuradas",
      "`/nivel canal-levelup` — (Admin) Canal de anúncios de level up",
      "📌 Ganhe **15–25 XP** por mensagem (cooldown: 1 min)",
    ],
  },
  profile: {
    emoji: "👤", label: "Perfil & Social", description: "Sua identidade no servidor",
    commands: [
      "`/perfil` — Perfil completo (nível, saldo, rep, conquistas)",
      "`/perfil @membro` — Perfil de outro membro",
      "`/rep dar @membro` — Dê +1 reputação (1x por dia)",
      "`/rep ver` — Veja a reputação de alguém",
      "`/afk [motivo]` — Ativa/desativa modo AFK",
      "`/avaliar dar` — Avalie um membro (1–5 ⭐)",
      "`/avaliar ver` — Veja avaliações",
      "`/userinfo` — Informações detalhadas de usuário",
      "`/avatar` — Avatar em tamanho grande",
    ],
  },
  games: {
    emoji: "🎮", label: "Jogos", description: "Aposte seus Dólares e ganhe mais",
    commands: [
      "`/uno` — Jogue UNO (custa 250 Dólares)",
      "`/domino` — Jogue Dominó (custa 250 Dólares)",
      "🏆 Vitória: **750 a 5.000 Dólares**",
    ],
  },
  events: {
    emoji: "🎉", label: "Sorteios & Eventos", description: "Entretenimento e interação para o servidor",
    commands: [
      "`/sorteio criar` — Cria um sorteio com botão de participação",
      "`/sorteio encerrar` — Encerra imediatamente",
      "`/sorteio resorteiar` — Sorteia novos vencedores",
      "`/evento criar` — Evento com botão de inscrição e aviso automático",
      "`/evento encerrar/listar/participantes` — Gerenciar eventos",
      "`/enquete criar` — Enquete com até 5 opções e gráfico ao vivo",
      "`/enquete encerrar` — Encerra uma enquete",
    ],
  },
  config: {
    emoji: "⚙️", label: "Configurações", description: "Configure o bot para o seu servidor",
    commands: [
      "`/boas-vindas configurar` — Mensagem de entrada e saída",
      "`/boas-vindas testar` — Preview da boas-vindas",
      "`/logs configurar` — Canais de log (mod, membros, msgs, voice)",
      "`/ticket configurar` — Sistema de atendimento por ticket",
      "`/ticket painel` — Painel de abertura de tickets",
      "`/cargos-reacao criar` — Painel de cargos por botão",
      "`/estrela configurar` — Starboard (melhores mensagens)",
      "`/antiraid configurar` — Proteção anti-raid",
      "`/antiraid lockdown` — Trava todos os canais",
      "`/parceria configurar` — Canal de parcerias",
    ],
  },
  utility: {
    emoji: "🔧", label: "Utilidades", description: "Ferramentas práticas do dia a dia",
    commands: [
      "`/lembrar criar` — Lembrete via DM (minutos/horas/dias)",
      "`/lembrar listar/cancelar` — Gerenciar lembretes",
      "`/serverinfo` — Estatísticas do servidor",
      "`/ping` — Latência do bot",
      "⚡ Prefixo alternativo: use `+ranking`, `+saldo`, etc.",
    ],
  },
};

export async function execute(interaction: ChatInputCommandInteraction) {
  const homeEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📖 Central de Comandos")
    .setDescription(
      "Bem-vindo à central de comandos! Selecione uma categoria abaixo para explorar.\n\n" +
      Object.values(CATEGORIES).map((c) => `${c.emoji} **${c.label}** — ${c.description}`).join("\n")
    )
    .addFields(
      { name: "📊 Total", value: `**${Object.values(CATEGORIES).reduce((a, c) => a + c.commands.length, 0)}+** comandos`, inline: true },
      { name: "⚡ Prefixo", value: "`/` ou `+`", inline: true },
      { name: "🌟 Dica", value: "Use `/daily` todo dia para ganhar Dólares!", inline: true },
    )
    .setFooter({ text: "Selecione uma categoria no menu abaixo • Bot de Alta Qualidade" })
    .setTimestamp();

  const menu = new StringSelectMenuBuilder()
    .setCustomId("help_menu")
    .setPlaceholder("📚 Escolha uma categoria...")
    .addOptions(
      Object.entries(CATEGORIES).map(([value, cat]) => ({
        label: cat.label,
        value,
        emoji: cat.emoji,
        description: cat.description,
      }))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

  const reply = await interaction.reply({ embeds: [homeEmbed], components: [row], ephemeral: true });

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 120_000,
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector.on("select", async (i: StringSelectMenuInteraction) => {
    const cat = CATEGORIES[i.values[0]];
    if (!cat) return;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${cat.emoji} ${cat.label}`)
      .setDescription(cat.commands.join("\n"))
      .setFooter({ text: "Use o menu para mudar de categoria • /ajuda" })
      .setTimestamp();
    await i.update({ embeds: [embed], components: [row] });
  });

  collector.on("end", () => {
    interaction.editReply({ components: [] }).catch(() => {});
  });
}
