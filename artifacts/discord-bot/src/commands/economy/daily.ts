import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { economyEmbed, errorEmbed, formatBalance, randomBetween, isSameDay, timeUntilMidnight } from "../../lib/helpers.js";
import { getOrCreateUser, addBalance, updateLastDaily } from "../../lib/db.js";

const HOME_SERVER_INVITE = "bmU6YEH9pu";
const HOME_GUILD_ID = process.env.HOME_GUILD_ID;

const TRIVIA: { question: string; answer: string; options: string[] }[] = [
  { question: "Qual é a capital do Brasil?", answer: "Brasília", options: ["Rio de Janeiro", "São Paulo", "Brasília", "Salvador"] },
  { question: "Quanto é 15 × 15?", answer: "225", options: ["200", "225", "215", "250"] },
  { question: "Qual planeta é o maior do sistema solar?", answer: "Júpiter", options: ["Saturno", "Urano", "Júpiter", "Netuno"] },
  { question: "Qual é o idioma mais falado do mundo?", answer: "Inglês", options: ["Espanhol", "Mandarim", "Inglês", "Hindi"] },
  { question: "Em que ano o Brasil foi descoberto?", answer: "1500", options: ["1492", "1500", "1510", "1488"] },
  { question: "Quantos lados tem um hexágono?", answer: "6", options: ["5", "6", "7", "8"] },
  { question: "Qual o maior oceano do mundo?", answer: "Pacífico", options: ["Atlântico", "Índico", "Pacífico", "Ártico"] },
  { question: "Quem escreveu 'Dom Casmurro'?", answer: "Machado de Assis", options: ["José de Alencar", "Machado de Assis", "Clarice Lispector", "Carlos Drummond"] },
  { question: "Quantos jogadores tem um time de futebol?", answer: "11", options: ["10", "11", "12", "9"] },
  { question: "Qual elemento químico tem o símbolo 'O'?", answer: "Oxigênio", options: ["Ouro", "Ósmio", "Oxigênio", "Olívio"] },
  { question: "Quantos continentes existem?", answer: "7", options: ["5", "6", "7", "8"] },
  { question: "Qual é a cor obtida misturando azul e amarelo?", answer: "Verde", options: ["Roxo", "Laranja", "Verde", "Marrom"] },
];

export const data = new SlashCommandBuilder()
  .setName("daily")
  .setDescription("Resgate seu bônus diário de Dólares respondendo uma pergunta!")
  .addStringOption((o) =>
    o.setName("resposta").setDescription("Responda a pergunta do daily!").setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const user = await getOrCreateUser(interaction.user.id, interaction.guildId!, interaction.user.username);

  if (user.lastDaily && isSameDay(new Date(user.lastDaily), new Date())) {
    return interaction.editReply({
      embeds: [
        errorEmbed("Daily já resgatado!", `Você já pegou seu daily hoje.\n⏰ Próximo daily em: **${timeUntilMidnight()}**`),
      ],
    });
  }

  const resposta = interaction.options.getString("resposta");

  if (!resposta) {
    const trivia = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
    const opcoesFormatadas = trivia.options.map((o, i) => `**${["A", "B", "C", "D"][i]})** ${o}`).join("\n");

    return interaction.editReply({
      embeds: [
        economyEmbed("Daily — Responda para ganhar!", `❓ **${trivia.question}**\n\n${opcoesFormatadas}\n\n💡 Use \`/daily resposta:<sua resposta>\` para responder!`)
          .setFooter({ text: "Acerte e ganhe de 3.000 a 5.000 Dólares! Sendo membro do servidor oficial, ganhe bônus extra!" }),
      ],
    });
  }

  const triviaToUse = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
  const acertou = TRIVIA.some((t) =>
    t.options.some((o) => o.toLowerCase() === resposta.toLowerCase()) &&
    t.answer.toLowerCase() === resposta.toLowerCase()
  ) || TRIVIA.some(t => t.answer.toLowerCase() === resposta.toLowerCase());

  if (!acertou) {
    return interaction.editReply({
      embeds: [
        errorEmbed("Resposta Incorreta!", `❌ Essa não era a resposta certa!\n\n💡 Use \`/daily\` primeiro para ver a pergunta e depois responda.`)
          .setFooter({ text: "Tente novamente amanhã!" }),
      ],
    });
  }

  const baseReward = randomBetween(3000, 5000);
  let bonus = 0;
  let bonusMsg = "";

  const isInHomeServer = interaction.guildId === HOME_GUILD_ID || true;
  if (isInHomeServer) {
    bonus = randomBetween(3000, 6000);
    bonusMsg = `\n🎁 **Bônus de membro do servidor oficial:** +${formatBalance(bonus)}`;
  }

  const total = baseReward + bonus;
  const newBalance = await addBalance(interaction.user.id, interaction.guildId!, total, "daily", "Daily reward");
  await updateLastDaily(interaction.user.id, interaction.guildId!);

  return interaction.editReply({
    embeds: [
      economyEmbed("Daily Resgatado! 🎉", `✅ Resposta correta!\n\n💵 **Recompensa base:** ${formatBalance(baseReward)}${bonusMsg}\n\n🏦 **Total ganho:** ${formatBalance(total)}\n💰 **Novo saldo:** ${formatBalance(newBalance)}`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: "Volte amanhã para mais Dólares!" }),
    ],
  });
}
