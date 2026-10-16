#!/bin/zsh
set -e
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo 'Установи Node.js 22.12+ с https://nodejs.org и запусти файл повторно'
  read -r '?Нажми Enter для выхода'
  exit 1
fi
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) { console.error("Нужен Node.js 22.12+"); process.exit(1); }'
if [[ ! -d node_modules/electron/dist || ! -f node_modules/typescript/bin/tsc ]]; then
  echo 'Устанавливаем зависимости проекта из package-lock.json'
  npm ci
fi
npm start
