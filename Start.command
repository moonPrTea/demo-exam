#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 22.12 or newer, then run this file again.'
  exit 1
fi
if [ ! -d node_modules/electron/dist ]; then
  echo 'Installing dependencies. Internet is required for this first step.'
  npm ci || exit 1
fi
npm start
