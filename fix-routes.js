const fs = require('fs');
const path = require('path');

// Find all route.ts files
function findRouteFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively search subdirectories
      files.push(...findRouteFiles(fullPath));
    } else if (item === 'route.ts') {
      // Check if this route file has dynamic segments in its path
      if (fullPath.includes('[') && fullPath.includes(']')) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

// Fix a route file
function fixRouteFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Pattern to match function signatures with params
  const patterns = [
    // Match: { params }: { params: { id: string } }
    /(\{\s*params\s*\}:\s*\{\s*params:\s*\{[^}]+\}\s*\})/g,
    // Match: context: { params: { id: string } }
    /(context:\s*\{\s*params:\s*\{[^}]+\}\s*\})/g,
    // Match: { params: _params }: { params: { id: string } }
    /(\{\s*params:\s*[^}]+\}:\s*\{\s*params:\s*\{[^}]+\}\s*\})/g
  ];
  
  // Replace patterns
  content = content.replace(
    /(\{\s*params\s*\}:\s*\{\s*params:\s*\{)([^}]+)(\}\s*\})/g,
    (match, prefix, paramTypes, suffix) => {
      modified = true;
      return `${prefix}Promise<{${paramTypes}}>${suffix}`;
    }
  );
  
  content = content.replace(
    /(context:\s*\{\s*params:\s*\{)([^}]+)(\}\s*\})/g,
    (match, prefix, paramTypes, suffix) => {
      modified = true;
      return `{ params }: { params: Promise<{${paramTypes}}> }`;
    }
  );
  
  content = content.replace(
    /(\{\s*params:\s*[^}]+\}:\s*\{\s*params:\s*\{)([^}]+)(\}\s*\})/g,
    (match, prefix, paramTypes, suffix) => {
      modified = true;
      return `{ params }: { params: Promise<{${paramTypes}}> }`;
    }
  );
  
  // Fix params usage - add await
  content = content.replace(
    /(const\s*\{\s*[^}]+\}\s*=\s*)params(;)/g,
    (match, prefix, suffix) => {
      modified = true;
      return `${prefix}await params${suffix}`;
    }
  );
  
  content = content.replace(
    /(const\s+params\s*=\s*await\s+context\.params;)/g,
    (match) => {
      modified = true;
      return match.replace('context.params', 'params');
    }
  );
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

// Main execution
const apiDir = path.join(__dirname, 'src', 'app', 'api');
const routeFiles = findRouteFiles(apiDir);

console.log(`Found ${routeFiles.length} route files with dynamic segments:`);
routeFiles.forEach(file => {
  console.log(`  ${file}`);
  fixRouteFile(file);
});

console.log('Done!');
