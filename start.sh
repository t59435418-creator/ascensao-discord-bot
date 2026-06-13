#!/bin/sh
set -e

echo "🚀 Iniciando Ascensão Bot..."
echo "🌍 Região: Frankfurt (Europa)"

echo "📦 Verificando banco de dados..."
pnpm --filter @workspace/db run push || echo "⚠️  Push do schema falhou (pode já estar atualizado)"

echo "🤖 Iniciando o bot..."
exec pnpm --filter @workspace/discord-bot run dev
