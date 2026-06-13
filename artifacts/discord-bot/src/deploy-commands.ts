import { REST, Routes } from "discord.js";
import { pathToFileURL, fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  throw new Error("DISCORD_TOKEN e DISCORD_CLIENT_ID precisam estar definidos!");
}

const commandsList: unknown[] = [];
const commandFolders = ["moderation", "economy", "utility"];

for (const folder of commandFolders) {
  const folderPath = path.join(__dirname, "commands", folder);
  if (!fs.existsSync(folderPath)) continue;
  const commandFiles = fs.readdirSync(folderPath).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const fileUrl = pathToFileURL(filePath).href;
    const command = await import(fileUrl);
    if ("data" in command) {
      commandsList.push(command.data.toJSON());
      console.log(`✅ Registrando: /${command.data.name}`);
    }
  }
}

const rest = new REST().setToken(token);

console.log(`\n🚀 Registrando ${commandsList.length} comando(s) globalmente...`);

const data = await rest.put(Routes.applicationCommands(clientId), { body: commandsList }) as unknown[];
console.log(`✅ ${data.length} comando(s) registrado(s) com sucesso!`);
