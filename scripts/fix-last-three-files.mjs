#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const files = [
  'components/Calendar/CalendarSettingsModal.tsx',
  'components/settings/HashtagsTab.tsx'
];

for (const file of files) {
  const filePath = join(rootDir, file);
  let content = readFileSync(filePath, 'utf-8');

  const before = content;
  content = content.replace(/hover:bg-\[#e5a610\]/g, 'hover:bg-accent-600');

  if (content !== before) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Fixed: ${file}`);
  }
}

console.log('\n🎉 All files fixed!');
