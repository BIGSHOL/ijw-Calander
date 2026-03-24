const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..', 'components');

function findModalFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findModalFiles(full));
    } else if (entry.name.includes('Modal') && entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

const files = findModalFiles(BASE);
let modified = 0;
let skipped = [];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  if (content.includes('useDraggable')) {
    skipped.push(path.relative(BASE, file) + ' (already has useDraggable)');
    continue;
  }
  if (content.includes('Common/Modal')) {
    skipped.push(path.relative(BASE, file) + ' (uses Common/Modal)');
    continue;
  }
  if (!content.includes('fixed inset-0')) {
    skipped.push(path.relative(BASE, file) + ' (no fixed inset-0)');
    continue;
  }

  const relDir = path.relative(path.dirname(file), path.join(BASE, '..', 'hooks')).replace(/\\/g, '/');
  const importStatement = "import { useDraggable } from '" + relDir + "/useDraggable';";

  // Add import after last import line
  const lines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) lastImportIdx = i;
    // multi-line imports
    if (lines[i].trim().startsWith('} from ')) lastImportIdx = i;
  }
  if (lastImportIdx === -1) {
    skipped.push(path.relative(BASE, file) + ' (no imports)');
    continue;
  }
  lines.splice(lastImportIdx + 1, 0, importStatement);
  content = lines.join('\n');

  // Add hook call after first hook usage in component
  const hookLine = '  const { handleMouseDown: handleDragMouseDown, dragStyle } = useDraggable();';
  const hookPatterns = ['useState(', 'useRef(', 'useEffect(', 'useMemo(', 'useCallback(', 'useEscapeClose(', 'useQueryClient('];
  let inserted = false;
  const contentLines = content.split('\n');

  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i].trim();
    if (hookPatterns.some(p => line.includes(p)) && !line.includes('useDraggable')) {
      contentLines.splice(i + 1, 0, hookLine);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    for (let i = 0; i < contentLines.length; i++) {
      const line = contentLines[i].trim();
      if ((line.endsWith('=> {') || line.endsWith(') {')) &&
          !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('if') && !line.startsWith('for')) {
        contentLines.splice(i + 1, 0, hookLine);
        inserted = true;
        break;
      }
    }
  }

  if (!inserted) {
    skipped.push(path.relative(BASE, file) + ' (no insertion point for hook)');
    continue;
  }
  content = contentLines.join('\n');

  // Add style={dragStyle} to modal container (bg-white...rounded...shadow)
  let replacedStyle = false;
  const bgWhiteRegex = /(<div\s[^>]*className="[^"]*bg-white[^"]*rounded[^"]*shadow[^"]*")/g;
  let match;
  while ((match = bgWhiteRegex.exec(content)) !== null) {
    const fullMatch = match[1];
    if (fullMatch.includes('style=')) continue;
    content = content.replace(fullMatch, fullMatch.replace('<div ', '<div style={dragStyle} '));
    replacedStyle = true;
    break;
  }

  if (!replacedStyle) {
    const altRegex = /(<div\s[^>]*className=\{[^}]*bg-white[^}]*\})/g;
    while ((match = altRegex.exec(content)) !== null) {
      const fullMatch = match[1];
      if (fullMatch.includes('style=')) continue;
      content = content.replace(fullMatch, fullMatch.replace('<div ', '<div style={dragStyle} '));
      replacedStyle = true;
      break;
    }
  }

  if (!replacedStyle) {
    skipped.push(path.relative(BASE, file) + ' (no modal container for dragStyle)');
    continue;
  }

  // Add onMouseDown to header div (border-b border-gray)
  let addedDrag = false;
  const headerRegex = /(<div\s[^>]*className="[^"]*border-b\s+border-gray[^"]*")/g;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(content)) !== null) {
    const fullMatch = headerMatch[1];
    if (fullMatch.includes('onMouseDown')) continue;
    let replacement = fullMatch;
    if (!replacement.includes('cursor-move')) {
      replacement = replacement.replace(/className="([^"]*)"/, (m, cls) => 'className="' + cls + ' cursor-move select-none"');
    }
    replacement = replacement.replace('<div ', '<div onMouseDown={handleDragMouseDown} ');
    content = content.replace(fullMatch, replacement);
    addedDrag = true;
    break;
  }

  if (!addedDrag) {
    const altHeaderRegex = /(<div\s[^>]*className="[^"]*border-b[^"]*")/g;
    while ((headerMatch = altHeaderRegex.exec(content)) !== null) {
      const fullMatch = headerMatch[1];
      if (fullMatch.includes('onMouseDown')) continue;
      if (!fullMatch.includes('flex')) continue;
      let replacement = fullMatch;
      if (!replacement.includes('cursor-move')) {
        replacement = replacement.replace(/className="([^"]*)"/, (m, cls) => 'className="' + cls + ' cursor-move select-none"');
      }
      replacement = replacement.replace('<div ', '<div onMouseDown={handleDragMouseDown} ');
      content = content.replace(fullMatch, replacement);
      addedDrag = true;
      break;
    }
  }

  fs.writeFileSync(file, content, 'utf8');
  modified++;
  console.log('MODIFIED: ' + path.relative(BASE, file) + (addedDrag ? '' : ' (no header drag handle)'));
}

console.log('\n--- Summary ---');
console.log('Modified: ' + modified);
console.log('Skipped: ' + skipped.length);
skipped.forEach(s => console.log('  SKIP: ' + s));
