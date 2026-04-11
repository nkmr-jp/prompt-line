vi.unmock('path');
vi.unmock('fs');

import fs from 'fs';
import path from 'path';
import os from 'os';
import { copyYamlFiles } from '../../scripts/plugin-install';

describe('copyYamlFiles', () => {
  let tmpDir: string;
  let sourceDir: string;
  let targetDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-install-test-'));
    sourceDir = path.join(tmpDir, 'source');
    targetDir = path.join(tmpDir, 'target');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createPluginDir(files: Record<string, { content: string; mode?: number }>) {
    const pluginDir = path.join(sourceDir, 'custom-search');
    fs.mkdirSync(pluginDir, { recursive: true });
    for (const [name, { content, mode }] of Object.entries(files)) {
      const filePath = path.join(pluginDir, name);
      fs.writeFileSync(filePath, content, 'utf-8');
      if (mode !== undefined) fs.chmodSync(filePath, mode);
    }
    return pluginDir;
  }

  it('copies non-YAML resource files alongside YAML files in plugin folders', () => {
    createPluginDir({
      'ghq.yaml': { content: 'name: test\nsourceCommand: "./ghq-list.sh"\n' },
      'ghq-list.sh': { content: '#!/bin/bash\nghq list\n', mode: 0o755 },
    });

    copyYamlFiles(sourceDir, targetDir, '', '', '', sourceDir);

    expect(fs.existsSync(path.join(targetDir, 'custom-search', 'ghq.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'custom-search', 'ghq-list.sh'))).toBe(true);
  });

  it('preserves executable permission on copied resource files', () => {
    createPluginDir({
      'test.yaml': { content: 'name: test\nsourceCommand: "./run.sh"\n' },
      'run.sh': { content: '#!/bin/bash\necho hello\n', mode: 0o755 },
    });

    copyYamlFiles(sourceDir, targetDir, '', '', '', sourceDir);

    const stat = fs.statSync(path.join(targetDir, 'custom-search', 'run.sh'));
    // Check owner-execute bit
    expect(stat.mode & 0o100).toBeTruthy();
  });

  it('counts only YAML files in totalFiles', () => {
    createPluginDir({
      'a.yaml': { content: 'name: a\nsourcePath: ~/test\n' },
      'b.yaml': { content: 'name: b\nsourcePath: ~/test\n' },
      'helper.sh': { content: '#!/bin/bash\n', mode: 0o755 },
    });

    const result = copyYamlFiles(sourceDir, targetDir, '', '', '', sourceDir);

    expect(result.totalFiles).toBe(2);
  });

  it('does not copy resource files outside valid plugin folders', () => {
    // Create a non-plugin directory (no valid type like custom-search/agent-skills)
    const invalidDir = path.join(sourceDir, 'other');
    fs.mkdirSync(invalidDir, { recursive: true });
    fs.writeFileSync(path.join(invalidDir, 'script.sh'), '#!/bin/bash\n', 'utf-8');
    fs.chmodSync(path.join(invalidDir, 'script.sh'), 0o755);

    copyYamlFiles(sourceDir, targetDir, '', '', '', sourceDir);

    expect(fs.existsSync(path.join(targetDir, 'other', 'script.sh'))).toBe(false);
  });
});
