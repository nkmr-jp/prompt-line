#!/usr/bin/env ts-node

import { showHelp } from './plugin-help';
import { main as install } from './plugin-install';

const command = process.argv[2];

switch (command) {
  case 'install':
    install(process.argv[3]);
    break;
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    showHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}
