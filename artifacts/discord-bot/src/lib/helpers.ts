import { EmbedBuilder, ColorResolvable } from "discord.js";

const BRAND_COLOR = 0x5865f2;
const SUCCESS_COLOR = 0x57f287;
const ERROR_COLOR = 0xed4245;
const WARN_COLOR = 0xfee75c;
const INFO_COLOR = 0x5865f2;
const ECON_COLOR = 0xf1c40f;

export function successEmbed(title: string, description: string) {
  return new EmbedBuilder()
    .setColor(SUCCESS_COLOR)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function errorEmbed(title: string, description: string) {
  return new EmbedBuilder()
    .setColor(ERROR_COLOR)
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function warnEmbed(title: string, description: string) {
  return new EmbedBuilder()
    .setColor(WARN_COLOR)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function infoEmbed(title: string, description: string, color: ColorResolvable = INFO_COLOR) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

export function economyEmbed(title: string, description: string) {
  return new EmbedBuilder()
    .setColor(ECON_COLOR)
    .setTitle(`💵 ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function brandEmbed(title: string, description?: string) {
  const e = new EmbedBuilder().setColor(BRAND_COLOR).setTitle(title).setTimestamp();
  if (description) e.setDescription(description);
  return e;
}

export function formatBalance(amount: number): string {
  return `**$${amount.toLocaleString("pt-BR")}** Dólares`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function timeUntilMidnight(): string {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

export function getMissionLabel(type: string): string {
  const labels: Record<string, string> = {
    chat: "💬 Enviar 10 mensagens no chat",
    react: "😄 Reagir a 5 mensagens",
    voice: "🎙️ Ficar 15 minutos em um canal de voz",
    mention: "📣 Mencionar 3 membros diferentes",
    invite: "📨 Convidar um amigo para o servidor",
    meme: "😂 Enviar um meme no canal certo",
    compliment: "💖 Elogiar um membro no chat",
    question: "❓ Fazer uma pergunta nos canais",
    game: "🎮 Participar de um jogo ou enquete",
    help: "🤝 Ajudar alguém no servidor",
    art: "🎨 Compartilhar uma arte ou desenho",
    music: "🎵 Compartilhar uma música no chat",
  };
  return labels[type] ?? type;
}

export function durationToMs(value: number, unit: string): number {
  const units: Record<string, number> = {
    segundos: 1000, minutos: 60_000, horas: 3_600_000, dias: 86_400_000,
  };
  return value * (units[unit] ?? 60_000);
}

export function msToHuman(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return `${Math.floor(ms / 86_400_000)}d`;
}

export function parseBoolean(val: string): boolean {
  return val === "true" || val === "sim" || val === "ativar";
}

export const BADGES: Record<string, string> = {
  rich: "💰 Milionário",
  top1: "🥇 #1 do Ranking",
  veteran: "🎖️ Veterano",
  generous: "🤝 Generoso",
  level10: "⭐ Nível 10",
  level25: "🌟 Nível 25",
  level50: "🏆 Nível 50",
};
