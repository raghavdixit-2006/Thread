// scripts/ensure-deps.mjs - make `npm start` self-healing on hosts that run the
// install step with --ignore-scripts, so the root postinstall never installed
// the API dependencies.
//
// It is a no-op when server/node_modules already has express, so a normal boot
// does not touch the network.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(root, 'server');

if (existsSync(path.join(serverDir, 'node_modules', 'express'))) {
  process.exit(0);
}

console.log('[thread] API dependencies are missing, installing server/ ...');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(
  npm,
  ['--prefix', serverDir, 'install', '--omit=dev', '--no-audit', '--no-fund'],
  { stdio: 'inherit', cwd: root, shell: process.platform === 'win32' },
);

if (result.error) {
  console.error('[thread] npm install failed to start:', result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
