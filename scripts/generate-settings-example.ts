/**
 * Script to generate settings.example.yml from shared settings
 *
 * This ensures settings.example.yml stays in sync with the values
 * defined in config/default-settings.ts (single source of truth)
 *
 * Usage: npx ts-node scripts/generate-settings-example.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Import shared settings (single source of truth)
import { defaultSettings } from '../src/config/default-settings';

// Import shared YAML generator (single source of truth for YAML generation)
import { generateSettingsYaml } from '../src/config/settings-yaml-generator';

// Generate and write settings.example.yml
const outputPath = path.join(__dirname, '..', 'settings.example.yml');
const content = generateSettingsYaml(defaultSettings, { includeCommentedExamples: true });

fs.writeFileSync(outputPath, content, 'utf8');
console.log(`Generated: ${outputPath}`);
