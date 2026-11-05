#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json
const packageJsonPath = join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

// Generate version.ts file
const versionContent = `// Auto-generated file - do not edit manually
// Generated from package.json version: ${packageJson.version}
export const VERSION = '${packageJson.version}';
`;

// Ensure src directory exists
const srcDir = join(__dirname, '../src');
mkdirSync(srcDir, { recursive: true });

// Write version file
const versionFilePath = join(srcDir, 'version.ts');
writeFileSync(versionFilePath, versionContent, 'utf-8');

console.log(`Generated version.ts with version: ${packageJson.version}`);
