/**
 * Dependency validator for TypeScript worker
 * 
 * This module provides functions to validate that required dependencies
 * are installed before executing a script.
 */

/**
 * Validates that all required dependencies are installed
 * 
 * @param requiredLibraries Array of library names to check
 * @returns Object with validation result and missing dependencies
 */
export function validateDependencies(requiredLibraries: string[]): { 
  valid: boolean; 
  missingDependencies: string[];
  error?: string;
} {
  if (!requiredLibraries || !Array.isArray(requiredLibraries) || requiredLibraries.length === 0) {
    return { valid: true, missingDependencies: [] };
  }

  const missingDependencies: string[] = [];

  for (const library of requiredLibraries) {
    try {
      // Try to require the library to check if it's installed
      require.resolve(library);
    } catch (error) {
      missingDependencies.push(library);
    }
  }

  if (missingDependencies.length > 0) {
    const error = `Missing dependencies: ${missingDependencies.join(', ')}. Please install these packages in the TypeScript worker.`;
    return { valid: false, missingDependencies, error };
  }

  return { valid: true, missingDependencies: [] };
}

/**
 * Extracts required libraries from script metadata
 * 
 * @param scriptContent TypeScript script content
 * @returns Array of required library names or null if not found
 */
export function extractRequiredLibraries(scriptContent: string): string[] | null {
  try {
    // Look for the getMetadata function and extract required_libraries
    const metadataMatch = scriptContent.match(/function\s+getMetadata\s*\(\s*\)\s*{[\s\S]*?required_libraries\s*:\s*\[([\s\S]*?)\]/);
    
    if (metadataMatch && metadataMatch[1]) {
      // Extract library names from the array
      const librariesStr = metadataMatch[1];
      const libraryMatches = librariesStr.match(/"([^"]+)"|'([^']+)'/g);
      
      if (libraryMatches) {
        return libraryMatches.map(match => match.replace(/["']/g, '').trim());
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting required libraries:', error);
    return null;
  }
}

/**
 * Formats a detailed error message for missing dependencies
 * 
 * @param missingDependencies Array of missing dependency names
 * @returns Formatted error message with installation instructions
 */
export function formatDependencyErrorMessage(missingDependencies: string[]): string {
  if (!missingDependencies || missingDependencies.length === 0) {
    return '';
  }

  return `
ERROR: Missing dependencies detected in TypeScript worker environment

The following dependencies are required by the script but are not installed:
${missingDependencies.map(dep => `  - ${dep}`).join('\n')}

To fix this issue:
1. Navigate to the TypeScript worker directory: cd src/workers/ts-worker
2. Install the missing dependencies: npm install ${missingDependencies.join(' ')}
3. Rebuild the worker: npm run build
4. Restart the worker: npm run dev

This error occurs when a script requires dependencies that are not installed in the worker environment.
`;
}
