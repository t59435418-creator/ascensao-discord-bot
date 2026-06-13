import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ButtonInteraction,
  ComponentType,
} from "discord.js";
import { economyEmbed, errorEmbed, formatBalance, randomBetween } from "../../lib/helpers.js";
import { getOrCreateUser, addBalance } from "../../lib/db.js";

const CUSTO = 250;

type Card = { color: string; value: string };

const COLORS = ["🔴", "🔵", "🟢", "🟡"];
const VALUES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+2", "↩️", "⏭️"];
const SPECIAL = ["🎨 +4", "🎨 Troca Cor"];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const color of COLORS) {
    for (const value of VALUES) {
      deck.push({ color, value });
      if (value !== "0") deck.push({ color, value });
    }
  }
  for (const s of SPECIAL) {
    for (let i = 0; i < 4; i++) deck.push({ color: "⬛", value: s });
  }
  return deck.sort(() => Math.random() - 0.5);
}

function cardStr(c: Card) { return `${c.color} ${c.value}`; }
function canPlay(card: Card, top: Card) {
  return card.color === "⬛" || card.color === top.color || card.value === top.value;
}

export const data = new SlashCommandBuilder()
  .setName("uno")
  .setDescription(`Jogue UNO contra o bot! Custa ${CUSTO} Dólares para participar.`);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const user = await getOrCreateUser(interaction.user.id, interaction.guildId!, interaction.user.username);
  if (user.balance < CUSTO) {
    return interaction.editReply({ embeds: [errorEmbed("Saldo Insuficiente", `Você precisa de ${formatBalance(CUSTO)} para jogar UNO.\nSeu saldo: ${formatBalance(user.balance)}`)] });
  }

  await addBalance(interaction.user.id, interaction.guildId!, -CUSTO, "game_entry", "Entrada no jogo UNO");

  const deck = createDeck();
  let playerHand = deck.splice(0, 7);
  let botHand = deck.splice(0, 7);
  let discard: Card[] = [deck.splice(0, 1)[0]];
  while (discard[0].color === "⬛") { discard = [deck.splice(0, 1)[0]]; }

  let turn = 0;
  let playerWon: boolean | null = null;
  let playedWell = true;
  let rounds = 0;

  const buildEmbed = () => {
    const top = discard[discard.length - 1];
    return new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🃏 UNO!")
      .addFields(
        { name: "🂠 Carta do Topo", value: cardStr(top), inline: true },
        { name: "🤖 Bot tem", value: `${botHand.length} carta(s)`, inline: true },
        { name: "🃏 Sua mão", value: playerHand.map(cardStr).join(" | ") || "Sem cartas!" },
      )
      .setFooter({ text: `Rodada ${rounds + 1} • Turno: ${turn % 2 === 0 ? "Seu" : "Bot"}` });
  };

  const buildButtons = () => {
    const top = discard[discard.length - 1];
    const playable = playerHand.filter((c) => canPlay(c, top));
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    const chunks: Card[][] = [];
    for (let i = 0; i < Math.min(playable.length, 10); i += 5) chunks.push(playable.slice(i, i + 5));

    for (const chunk of chunks) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        chunk.map((c, i) =>
          new ButtonBuilder()
            .setCustomId(`uno_play_${playerHand.indexOf(c)}`)
            .setLabel(cardStr(c))
            .setStyle(ButtonStyle.Primary)
        )
      );
      rows.push(row);
    }

    const extraRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("uno_draw").setLabel("🃏 Comprar").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("uno_quit").setLabel("❌ Desistir").setStyle(ButtonStyle.Danger),
    );
    rows.push(extraRow);
    return rows.slice(0, 5);
  };

  const msg = await interaction.editReply({ embeds: [buildEmbed()], components: buildButtons() });

  const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

  collector.on("collect", async (btn: ButtonInteraction) => {
    if (btn.user.id !== interaction.user.id) {
      await btn.reply({ content: "Não é a sua partida!", ephemeral: true });
      return;
    }

    await btn.deferUpdate();
    const top = discard[discard.length - 1];

    if (btn.customId === "uno_quit") {
      playedWell = false;
      playerWon = false;
      collector.stop("quit");
      return;
    }

    if (btn.customId === "uno_draw") {
      if (deck.length === 0) { playerWon = false; collector.stop("end"); return; }
      playerHand.push(deck.splice(0, 1)[0]);
      playedWell = false;
      rounds++;
    } else if (btn.customId.startsWith("uno_play_")) {
      const idx = parseInt(btn.customId.split("_")[2]);
      const card = playerHand[idx];
      if (!canPlay(card, top)) {
        await btn.followUp({ content: "Essa carta não pode ser jogada!", ephemeral: true });
        return;
      }
      discard.push(card);
      playerHand.splice(idx, 1);
      rounds++;

      if (playerHand.length === 0) { playerWon = true; collector.stop("end"); return; }

      if (card.value === "+2") {
        for (let i = 0; i < 2; i++) botHand.push(deck.splice(0, 1)[0] ?? { color: "🔴", value: "0" });
      } else if (card.value === "🎨 +4") {
        for (let i = 0; i < 4; i++) botHand.push(deck.splice(0, 1)[0] ?? { color: "🔴", value: "0" });
      }
    }

    const newTop = discard[discard.length - 1];
    let botPlayed = false;
    for (let i = 0; i < botHand.length; i++) {
      if (canPlay(botHand[i], newTop)) {
        discard.push(botHand[i]);
        botHand.splice(i, 1);
        botPlayed = true;
        break;
      }
    }
    if (!botPlayed) botHand.push(deck.splice(0, 1)[0] ?? { color: "🔴", value: "0" });

    if (botHand.length === 0) { playerWon = false; collector.stop("end"); return; }

    await btn.editReply({ embeds: [buildEmbed()], components: buildButtons() });
  });

  collector.on("end", async () => {
    if (playerWon === null) playerWon = false;

    let reward = 0;
    let resultMsg = "";

    if (playerWon) {
      reward = playedWell ? randomBetween(3000, 5000) : randomBetween(750, 3000);
      await addBalance(interaction.user.id, interaction.guildId!, reward, "game_win", "Vitória no UNO");
      resultMsg = `🎉 **Você ganhou o UNO!**\n💵 Prêmio: ${formatBalance(reward)}\n${!playedWell ? "*(Jogou com dificuldades, prêmio reduzido)*" : ""}`;
    } else {
      resultMsg = `😔 **Você perdeu o UNO!**\nO bot venceu desta vez. Tente novamente!\n💸 Você perdeu: ${formatBalance(CUSTO)}`;
    }

    const finalEmbed = new EmbedBuilder()
      .setColor(playerWon ? 0x2ecc71 : 0xe74c3c)
      .setTitle("🃏 Fim de Jogo — UNO!")
      .setDescription(resultMsg)
      .setTimestamp();

    await interaction.editReply({ embeds: [finalEmbed], components: [] }).catch(() => {});
  });
}
