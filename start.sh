#!/bin/sh
# start.sh - entrypoint for panels that run a shell command inside the container
# root (Botkeep / Pterodactyl). Works from any working directory and installs the
# API dependencies when the panel's install step was skipped.
set -e
cd "$(dirname "$0")"
node scripts/ensure-deps.mjs
exec node server/src/server.js
