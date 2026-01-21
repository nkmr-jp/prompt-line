#!/usr/bin/env node
/**
 * Post-install script to fix vulnerabilities in npm's bundled dependencies.
 * npm bundles tar and diff which have known vulnerabilities.
 * This script replaces them with patched versions.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const npmPath = path.join(__dirname, '..', 'node_modules', 'npm', 'node_modules');

// Only run if npm package exists (it's a dev dependency)
if (!fs.existsSync(npmPath)) {
  console.log('npm package not found, skipping vulnerability fix');
  process.exit(0);
}

const fixes = [
  {
    name: 'tar',
    vulnerableVersions: ['7.5.2', '7.5.3'],
    targetVersion: '7.5.6',
    path: path.join(npmPath, 'tar')
  },
  {
    name: 'diff',
    vulnerableVersions: ['8.0.2'],
    targetVersion: '8.0.3',
    path: path.join(npmPath, 'diff')
  }
];

for (const fix of fixes) {
  if (!fs.existsSync(fix.path)) {
    console.log(`${fix.name} not found at ${fix.path}, skipping`);
    continue;
  }

  try {
    const pkgPath = path.join(fix.path, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    if (fix.vulnerableVersions.includes(pkg.version)) {
      console.log(`Fixing ${fix.name}@${pkg.version} -> ${fix.targetVersion}`);

      // Remove the vulnerable version
      fs.rmSync(fix.path, { recursive: true, force: true });

      // Install the fixed version in the npm package's node_modules
      execSync(`npm pack ${fix.name}@${fix.targetVersion}`, {
        cwd: path.dirname(fix.path),
        stdio: 'pipe'
      });

      const tarball = `${fix.name}-${fix.targetVersion}.tgz`;
      const tarballPath = path.join(path.dirname(fix.path), tarball);

      execSync(`tar -xzf ${tarball}`, {
        cwd: path.dirname(fix.path),
        stdio: 'pipe'
      });

      // Rename 'package' to the module name
      const extractedPath = path.join(path.dirname(fix.path), 'package');
      fs.renameSync(extractedPath, fix.path);

      // Clean up tarball
      fs.unlinkSync(tarballPath);

      console.log(`Fixed ${fix.name} to ${fix.targetVersion}`);
    } else {
      console.log(`${fix.name}@${pkg.version} is not vulnerable, skipping`);
    }
  } catch (error) {
    console.error(`Failed to fix ${fix.name}: ${error.message}`);
  }
}

console.log('Vulnerability fix script completed');
