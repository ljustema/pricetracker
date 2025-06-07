const fs = require('fs');
const path = require('path');

// Find all page.tsx files that use params or searchParams
function findPageFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively search subdirectories
      files.push(...findPageFiles(fullPath));
    } else if (item === 'page.tsx') {
      // Check if this page file uses params or searchParams
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('params:') || content.includes('searchParams')) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

// Fix a page file
function fixPageFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Pattern to match interface definitions with params or searchParams
  const interfacePattern = /(interface\s+\w+\s*\{[^}]*(?:params|searchParams):\s*[^}]+\})/gs;

  content = content.replace(interfacePattern, (match) => {
    let fixed = match;

    // Replace params: { ... } with params: Promise<{ ... }>
    if (match.includes('params:') && !match.includes('params: Promise<{')) {
      fixed = fixed.replace(
        /(params:\s*)(\{[^}]+\})/g,
        '$1Promise<$2>'
      );
      modified = true;
    }

    // Replace searchParams?: { ... } with searchParams?: Promise<{ ... }>
    if (match.includes('searchParams') && !match.includes('searchParams?: Promise<{')) {
      fixed = fixed.replace(
        /(searchParams\?\s*:\s*)(\{[^}]+\})/g,
        '$1Promise<$2>'
      );
      modified = true;
    }

    return fixed;
  });
  
  // Also fix type definitions
  const typePattern = /(type\s+\w+\s*=\s*\{[^}]*(?:params|searchParams):\s*[^}]+\})/gs;

  content = content.replace(typePattern, (match) => {
    let fixed = match;

    // Replace params: { ... } with params: Promise<{ ... }>
    if (match.includes('params:') && !match.includes('params: Promise<{')) {
      fixed = fixed.replace(
        /(params:\s*)(\{[^}]+\})/g,
        '$1Promise<$2>'
      );
      modified = true;
    }

    // Replace searchParams?: { ... } with searchParams?: Promise<{ ... }>
    if (match.includes('searchParams') && !match.includes('searchParams?: Promise<{')) {
      fixed = fixed.replace(
        /(searchParams\?\s*:\s*)(\{[^}]+\})/g,
        '$1Promise<$2>'
      );
      modified = true;
    }

    return fixed;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

// Main execution
const appDir = path.join(__dirname, 'src', 'app');
const pageFiles = findPageFiles(appDir);

console.log(`Found ${pageFiles.length} page files with params or searchParams:`);
pageFiles.forEach(file => {
  console.log(`  ${file}`);
  fixPageFile(file);
});

console.log('Done!');
