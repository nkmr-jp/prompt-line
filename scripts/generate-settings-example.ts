/**
 * Script to generate settings.example.yml from shared settings
 *
 * This ensures settings.example.yml stays in sync with the values
 * defined in config/default-settings.ts (single source of truth)
 *
 * Usage: pnpm exec ts-node scripts/generate-settings-example.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Import shared settings (single source of truth)
import { defaultSettings } from '../src/config/default-settings';

// Import shared YAML generator (single source of truth for YAML generation)
import { generateSettingsYaml } from '../src/config/settings-yaml-generator';

// Generate and write settings.example.yml
const outputPath = path.join(__dirname, '..', 'settings.example.yml');
const outputDir = path.dirname(outputPath);

try {
  // Validate that output directory exists
  if (!fs.existsSync(outputDir)) {
    throw new Error(`Output directory does not exist: ${outputDir}`);
  }

  // Generate YAML content
  const content = generateSettingsYaml(defaultSettings, { includeCommentedExamples: true });

  // Write to file
  fs.writeFileSync(outputPath, content, 'utf8');

  // Success indicator
  console.log(`✅ Generated: ${outputPath}`);
} catch (error) {
  // Detailed error message
  console.error(`❌ Failed to generate settings example file:`);
  console.error(`   Output path: ${outputPath}`);
  if (error instanceof Error) {
    console.error(`   Error: ${error.message}`);
  } else {
    console.error(`   Error: ${String(error)}`);
  }
  process.exit(1);
}
