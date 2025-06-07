const fs = require('fs');
const path = require('path');

// Find all page.tsx files with dynamic segments
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
      // Check if this page file has dynamic segments in its path
      if (fullPath.includes('[') && fullPath.includes(']')) {
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
  
  // Pattern to match interface definitions with params
  const interfacePattern = /(interface\s+\w+\s*\{[^}]*params:\s*\{[^}]+\}[^}]*\})/gs;
  
  content = content.replace(interfacePattern, (match) => {
    if (match.includes('Promise<{')) {
      // Already fixed
      return match;
    }
    
    // Replace params: { ... } with params: Promise<{ ... }>
    const fixed = match.replace(
      /(params:\s*)(\{[^}]+\})/g,
      '$1Promise<$2>'
    );
    
    if (fixed !== match) {
      modified = true;
      return fixed;
    }
    return match;
  });
  
  // Also fix type definitions
  const typePattern = /(type\s+\w+\s*=\s*\{[^}]*params:\s*\{[^}]+\}[^}]*\})/gs;
  
  content = content.replace(typePattern, (match) => {
    if (match.includes('Promise<{')) {
      // Already fixed
      return match;
    }
    
    // Replace params: { ... } with params: Promise<{ ... }>
    const fixed = match.replace(
      /(params:\s*)(\{[^}]+\})/g,
      '$1Promise<$2>'
    );
    
    if (fixed !== match) {
      modified = true;
      return fixed;
    }
    return match;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

// Main execution
const appDir = path.join(__dirname, 'src', 'app');
const pageFiles = findPageFiles(appDir);

console.log(`Found ${pageFiles.length} page files with dynamic segments:`);
pageFiles.forEach(file => {
  console.log(`  ${file}`);
  fixPageFile(file);
});

console.log('Done!');
