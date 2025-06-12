import { execSync } from 'child_process';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { debugLog } from './debug-logger';

// Cache for shared dependencies to reduce memory usage
const SHARED_DEPS_DIR = path.join(os.tmpdir(), 'ts-worker-shared-deps');
let sharedDepsInitialized = false;
let isInitializing = false; // Prevent concurrent initialization

/**
 * Force cleanup of shared dependencies (for immediate use)
 */
export async function forceCleanupSharedDependencies(): Promise<void> {
  debugLog('Force cleaning up shared dependencies...');
  sharedDepsInitialized = false;
  await cleanupSharedDependencies();
}

// Interface for compiler options
interface CompilerOptions {
  timeout?: number;
}

// Interface for compiler result
export interface CompilerResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  tempDir?: string;
}

/**
 * Validate shared dependencies cache
 */
async function validateSharedDependencies(): Promise<boolean> {
  try {
    debugLog(`Validating shared dependencies in: ${SHARED_DEPS_DIR}`);
    const nodeModulesPath = path.join(SHARED_DEPS_DIR, 'node_modules');
    const packageJsonPath = path.join(SHARED_DEPS_DIR, 'package.json');

    debugLog(`Checking paths: ${nodeModulesPath}, ${packageJsonPath}`);

    // Check if basic structure exists
    if (!fs.existsSync(nodeModulesPath) || !fs.existsSync(packageJsonPath)) {
      debugLog(`Shared dependencies structure missing - nodeModules: ${fs.existsSync(nodeModulesPath)}, packageJson: ${fs.existsSync(packageJsonPath)}`);
      return false;
    }

    // Check for critical dependencies
    const criticalDeps = ['typescript', 'yargs', 'fast-xml-parser', 'crawlee', 'playwright', '@supabase'];
    debugLog(`Checking critical dependencies: ${criticalDeps.join(', ')}`);
    for (const dep of criticalDeps) {
      const depPath = path.join(nodeModulesPath, dep);
      const exists = fs.existsSync(depPath);
      debugLog(`Dependency ${dep}: ${exists ? 'found' : 'missing'} at ${depPath}`);
      if (!exists) {
        debugLog(`Critical dependency missing: ${dep}`);
        return false;
      }
    }

    // Check for corrupted Crawlee installation (the source of our current issue)
    const crawleePath = path.join(nodeModulesPath, '@crawlee', 'http', 'internals', 'http-crawler.d.ts');
    if (fs.existsSync(crawleePath)) {
      try {
        const content = await fsPromises.readFile(crawleePath, 'utf-8');
        // Check for syntax errors that would cause TypeScript compilation to fail
        if (content.includes('error TS1109') || content.includes('Expression expected') || content.length < 100) {
          debugLog('Corrupted Crawlee type definitions detected');
          return false;
        }
      } catch (_readError) {
        debugLog('Failed to read Crawlee type definitions');
        return false;
      }
    }

    debugLog('Shared dependencies validation passed');
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog(`Shared dependencies validation failed: ${errorMessage}`);
    return false;
  }
}

/**
 * Clean up corrupted shared dependencies
 */
async function cleanupSharedDependencies(): Promise<void> {
  try {
    if (fs.existsSync(SHARED_DEPS_DIR)) {
      debugLog('Cleaning up corrupted shared dependencies...');
      await fsPromises.rm(SHARED_DEPS_DIR, { recursive: true, force: true });
      debugLog('Corrupted shared dependencies removed');
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog(`Failed to cleanup shared dependencies: ${errorMessage}`);
  }
}

/**
 * Initialize shared dependencies to reduce memory usage
 */
async function initializeSharedDependencies(): Promise<void> {
  // Prevent concurrent initialization
  if (isInitializing) {
    debugLog('Shared dependencies initialization already in progress, waiting...');
    // Wait for initialization to complete
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return;
  }

  if (sharedDepsInitialized) {
    // Validate existing cache
    const isValid = await validateSharedDependencies();
    if (!isValid) {
      debugLog('Existing shared dependencies are corrupted, reinitializing...');
      await cleanupSharedDependencies();
      sharedDepsInitialized = false;
    } else {
      debugLog('Shared dependencies already initialized and valid');
      return;
    }
  }

  isInitializing = true;
  try {
    debugLog('Initializing comprehensive shared dependencies cache...');
    debugLog(`Shared dependencies directory: ${SHARED_DEPS_DIR}`);

    // Create shared dependencies directory
    await fsPromises.mkdir(SHARED_DEPS_DIR, { recursive: true });
    debugLog('Shared dependencies directory created');

    // Create package.json for shared dependencies with ALL required packages
    const packageJson = {
      name: "ts-worker-shared-deps",
      version: "1.0.0",
      private: true,
      dependencies: {
        // Core compilation tools
        "typescript": "^5.0.0",
        "@types/node": "^18.15.0",

        // Scraper dependencies - install once and reuse
        "crawlee": "^3.13.3",
        "playwright": "^1.40.0",
        "yargs": "^17.6.2",
        "fast-xml-parser": "^5.2.0",
        "node-fetch": "^2.6.7",
        "jsdom": "^21.1.0",
        "@supabase/supabase-js": "^2.0.0",

        // Babel fallback tools
        "@babel/cli": "^7.21.0",
        "@babel/core": "^7.21.0",
        "@babel/preset-env": "^7.21.0",
        "@babel/preset-typescript": "^7.21.0"
      }
    };

    const packageJsonPath = path.join(SHARED_DEPS_DIR, 'package.json');
    await fsPromises.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
    debugLog('Package.json created for shared dependencies');

    // Install dependencies once with optimized settings
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    debugLog('Installing comprehensive shared dependencies (one-time setup)...');
    debugLog(`Using npm command: ${npmCommand}`);

    try {
      debugLog(`Executing: ${npmCommand} install --no-package-lock --no-save --prefer-offline --no-audit --no-fund`);
      const result = execSync(`${npmCommand} install --no-package-lock --no-save --prefer-offline --no-audit --no-fund`, {
        cwd: SHARED_DEPS_DIR,
        stdio: 'pipe',
        timeout: 600000, // 10 minutes timeout for comprehensive install
        encoding: 'utf8'
      });
      debugLog('npm install completed successfully');
      debugLog(`npm install output: ${result}`);
    } catch (npmError: unknown) {
      const npmErrorMessage = npmError instanceof Error ? npmError.message : String(npmError);
      let stderrOutput = '';
      let stdoutOutput = '';

      // Extract stderr and stdout if available
      if (npmError && typeof npmError === 'object') {
        if ('stderr' in npmError && npmError.stderr) {
          stderrOutput = String(npmError.stderr);
        }
        if ('stdout' in npmError && npmError.stdout) {
          stdoutOutput = String(npmError.stdout);
        }
      }

      debugLog(`npm install failed: ${npmErrorMessage}`);
      if (stderrOutput) debugLog(`npm stderr: ${stderrOutput}`);
      if (stdoutOutput) debugLog(`npm stdout: ${stdoutOutput}`);

      throw new Error(`npm install failed: ${npmErrorMessage}${stderrOutput ? ` - stderr: ${stderrOutput}` : ''}`);
    }

    // Validate installation
    debugLog('Validating shared dependencies installation...');
    const isValid = await validateSharedDependencies();
    if (!isValid) {
      throw new Error('Shared dependencies validation failed after installation');
    }

    sharedDepsInitialized = true;
    debugLog('Comprehensive shared dependencies cache initialized successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog(`Failed to initialize shared dependencies: ${errorMessage}`);
    // Clean up failed installation
    await cleanupSharedDependencies();
    sharedDepsInitialized = false;
    throw error; // Re-throw to let caller know initialization failed
  } finally {
    isInitializing = false;
  }
}

/**
 * Compiles a TypeScript scraper script to JavaScript
 * @param scriptContent The TypeScript script content
 * @param options Compiler options
 * @returns A promise that resolves to the path of the compiled JavaScript file
 */
export async function compileTypeScriptScraper(
  scriptContent: string,
  options: CompilerOptions = {}
): Promise<CompilerResult> {
  const TIMEOUT_MS = options.timeout || 60000; // Default to 60 seconds

  // Try to initialize shared dependencies, but don't fail if it doesn't work
  debugLog('Starting shared dependencies initialization...');
  try {
    await initializeSharedDependencies();
    debugLog('Shared dependencies initialized successfully');
  } catch (sharedDepsError: unknown) {
    const errorMessage = sharedDepsError instanceof Error ? sharedDepsError.message : String(sharedDepsError);
    debugLog(`Shared dependencies initialization failed: ${errorMessage}`);
    debugLog('Will attempt to use fallback dependency installation method');
    // Reset the flag so fallback will be used
    sharedDepsInitialized = false;
  }

  // Create a unique temporary directory
  const uuid = randomUUID();
  const tempDir = path.join(os.tmpdir(), `ts-worker-${uuid}`);
  const tempTsFilePath = path.join(tempDir, 'scraper.ts');

  debugLog(`Creating temporary directory: ${tempDir}`);

  try {
    // Create temporary directory
    await fsPromises.mkdir(tempDir, { recursive: true });

    // Write script content to a temporary TypeScript file
    await fsPromises.writeFile(tempTsFilePath, scriptContent, 'utf-8');
    debugLog(`Temporary TypeScript script written to ${tempTsFilePath}`);

    // Use symlinks to shared dependencies instead of copying/installing
    debugLog('Setting up symlinks to shared dependencies...');

    // Create package.json for this compilation (minimal, just for TypeScript)
    const packageJson = {
      name: "temp-scraper-execution",
      version: "1.0.0",
      private: true,
      dependencies: {}
    };

    const packageJsonPath = path.join(tempDir, 'package.json');
    await fsPromises.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
    debugLog(`Created minimal package.json at ${packageJsonPath}`);

    // Create symlink to shared node_modules
    const tempNodeModules = path.join(tempDir, 'node_modules');
    const sharedNodeModules = path.join(SHARED_DEPS_DIR, 'node_modules');

    // Try to use shared dependencies first
    debugLog(`Checking shared dependencies: initialized=${sharedDepsInitialized}`);
    const sharedDepsValid = sharedDepsInitialized && await validateSharedDependencies();
    debugLog(`Shared dependencies validation result: ${sharedDepsValid}`);

    if (sharedDepsValid) {
      debugLog('Using shared dependencies with copy method (Railway-compatible)...');

      // Copy the entire node_modules directory (no symlinks for Railway compatibility)
      try {
        debugLog('Copying shared dependencies to temp directory...');
        if (process.platform === 'win32') {
          execSync(`robocopy "${sharedNodeModules}" "${tempNodeModules}" /E /NFL /NDL /NJH /NJS /NC /NS`, { stdio: 'pipe' });
        } else {
          execSync(`cp -r "${sharedNodeModules}" "${tempNodeModules}"`, { stdio: 'pipe' });
        }
        debugLog('Copy of shared dependencies completed');

        // Verify the copy worked and crawlee is functional
        const crawleePath = path.join(tempNodeModules, 'crawlee');
        if (!fs.existsSync(crawleePath)) {
          throw new Error('Copy verification failed - crawlee not found');
        }

        // Test that crawlee can actually be required from the copied location
        try {
          const testScript = `
            const fs = require('fs');
            const path = require('path');
            try {
              const crawlee = require('crawlee');
              console.log('Crawlee test successful');
              process.exit(0);
            } catch (error) {
              console.error('Crawlee module test failed:', error.message);
              process.exit(1);
            }
          `;

          const testPath = path.join(tempDir, 'crawlee-test.js');
          await fsPromises.writeFile(testPath, testScript, 'utf-8');

          execSync(`node "${testPath}"`, {
            cwd: tempDir,
            stdio: 'pipe',
            timeout: 30000 // 30 seconds timeout for test
          });

          debugLog('Shared dependencies setup completed successfully - crawlee working');
        } catch (testError: unknown) {
          const testErrorMessage = testError instanceof Error ? testError.message : String(testError);
          debugLog(`Crawlee test failed: ${testErrorMessage}`);
          throw new Error('Copy verification failed - crawlee not working');
        }
      } catch (copyError: unknown) {
        const copyErrorMessage = copyError instanceof Error ? copyError.message : String(copyError);
        debugLog(`Failed to copy shared dependencies: ${copyErrorMessage}`);
        debugLog('Falling back to fresh npm install...');
        throw new Error('Shared dependencies copy failed');
      }
    } else {
      debugLog('Shared dependencies not available, using fallback npm install...');

      // Fallback: Install dependencies directly in temp directory
      try {
        const fallbackPackageJson = {
          name: "temp-scraper",
          version: "1.0.0",
          private: true,
          dependencies: {
            "typescript": "^5.0.0",
            "crawlee": "^3.13.3",
            "playwright": "^1.40.0",
            "yargs": "^17.6.2",
            "fast-xml-parser": "^5.2.0",
            "node-fetch": "^2.6.7",
            "jsdom": "^21.1.0",
            "@supabase/supabase-js": "^2.0.0"
          }
        };

        // Overwrite the minimal package.json with full dependencies
        await fsPromises.writeFile(packageJsonPath, JSON.stringify(fallbackPackageJson, null, 2), 'utf-8');
        debugLog('Created fallback package.json with full dependencies');

        // Install dependencies
        const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        debugLog('Installing dependencies directly in temp directory...');
        debugLog(`Executing: ${npmCommand} install --no-package-lock --no-save --prefer-offline --no-audit --no-fund`);

        try {
          const result = execSync(`${npmCommand} install --no-package-lock --no-save --prefer-offline --no-audit --no-fund`, {
            cwd: tempDir,
            stdio: 'pipe',
            timeout: 300000, // 5 minutes timeout
            encoding: 'utf8'
          });
          debugLog('Fallback npm install completed successfully');
          debugLog(`Fallback npm install output: ${result}`);
        } catch (fallbackNpmError: unknown) {
          const fallbackNpmErrorMessage = fallbackNpmError instanceof Error ? fallbackNpmError.message : String(fallbackNpmError);
          let stderrOutput = '';
          let stdoutOutput = '';

          // Extract stderr and stdout if available
          if (fallbackNpmError && typeof fallbackNpmError === 'object') {
            if ('stderr' in fallbackNpmError && fallbackNpmError.stderr) {
              stderrOutput = String(fallbackNpmError.stderr);
            }
            if ('stdout' in fallbackNpmError && fallbackNpmError.stdout) {
              stdoutOutput = String(fallbackNpmError.stdout);
            }
          }

          debugLog(`Fallback npm install failed: ${fallbackNpmErrorMessage}`);
          if (stderrOutput) debugLog(`Fallback npm stderr: ${stderrOutput}`);
          if (stdoutOutput) debugLog(`Fallback npm stdout: ${stdoutOutput}`);

          throw new Error(`Fallback npm install failed: ${fallbackNpmErrorMessage}${stderrOutput ? ` - stderr: ${stderrOutput}` : ''}`);
        }

        // Verify crawlee is available and working
        const crawleePath = path.join(tempNodeModules, 'crawlee');
        if (!fs.existsSync(crawleePath)) {
          throw new Error('Fallback install verification failed - crawlee not found');
        }

        // Test that crawlee can actually be required
        try {
          const testScript = `
            const fs = require('fs');
            const path = require('path');
            try {
              const crawlee = require('crawlee');
              console.log('Crawlee test successful');
              process.exit(0);
            } catch (error) {
              console.error('Crawlee module test failed:', error.message);
              process.exit(1);
            }
          `;

          const testPath = path.join(tempDir, 'crawlee-test.js');
          await fsPromises.writeFile(testPath, testScript, 'utf-8');

          execSync(`node "${testPath}"`, {
            cwd: tempDir,
            stdio: 'pipe',
            timeout: 30000 // 30 seconds timeout for test
          });

          debugLog('Fallback install verification successful - crawlee working');
        } catch (testError: unknown) {
          const testErrorMessage = testError instanceof Error ? testError.message : String(testError);
          debugLog(`Crawlee test failed: ${testErrorMessage}`);
          throw new Error(`Crawlee functionality test failed: ${testErrorMessage}`);
        }
      } catch (fallbackError: unknown) {
        const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        debugLog(`Fallback npm install failed: ${fallbackErrorMessage}`);
        throw new Error(`Failed to set up dependencies: ${fallbackErrorMessage}`);
      }
    }

    // Create a tsconfig.json file with very permissive settings to effectively skip type checking
    const tsConfigContent = {
      compilerOptions: {
        target: "ES2022", // Increase target to support newer regex flags and features
        module: "CommonJS",
        moduleResolution: "Node",
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true, // Skip type checking of declaration files
        skipDefaultLibCheck: true, // Skip checking .d.ts files included with TypeScript
        resolveJsonModule: true,
        outDir: ".",
        noImplicitAny: false,
        strictNullChecks: false,
        allowJs: true,
        noEmitOnError: false, // Continue emitting output even if there are errors
        isolatedModules: true, // Treat each file as a separate module (faster compilation)
        suppressImplicitAnyIndexErrors: true,
        ignoreDeprecations: "5.0",
        downlevelIteration: true,
        noEmit: false, // Ensure we emit JavaScript output
        emitDeclarationOnly: false, // Ensure we emit JavaScript output, not just declarations
        checkJs: false, // Don't type-check JavaScript files
        strict: false, // Disable all strict type checking
        noImplicitThis: false, // Disable 'this' type checking
        noUnusedLocals: false, // Don't report unused locals
        noUnusedParameters: false, // Don't report unused parameters
        noFallthroughCasesInSwitch: false, // Don't report fallthrough cases in switch
        allowUnreachableCode: true, // Allow unreachable code
        allowUnusedLabels: true, // Allow unused labels
        incremental: false, // Disable incremental compilation for faster one-time builds
        composite: false, // Disable composite project features
        declaration: false, // Don't generate declaration files
        declarationMap: false, // Don't generate declaration source maps
        sourceMap: false, // Don't generate source maps for faster compilation
        lib: ["ES2022", "DOM"] // Include necessary libraries
      },
      include: ["scraper.ts"],
      exclude: ["node_modules"]
    };

    const tsConfigPath = path.join(tempDir, 'tsconfig.json');
    await fsPromises.writeFile(tsConfigPath, JSON.stringify(tsConfigContent, null, 2), 'utf-8');
    debugLog(`Created tsconfig.json at ${tsConfigPath}`);

    // Use Babel as the primary compiler (TypeScript compiler has never worked successfully)
    debugLog('Compiling TypeScript using Babel (primary compiler)');

    try {
          // Create a babel.config.json file
          const babelConfig = {
            presets: [
              "@babel/preset-env",
              "@babel/preset-typescript"
            ]
          };

          // Install Babel dependencies AND runtime dependencies if not already in package.json
          debugLog('Installing Babel dependencies and runtime dependencies');
          execSync('npm install --no-package-lock --no-save @babel/cli @babel/core @babel/preset-env @babel/preset-typescript crawlee playwright yargs fast-xml-parser node-fetch jsdom @supabase/supabase-js', {
            cwd: tempDir,
            stdio: 'pipe',
            timeout: TIMEOUT_MS / 2
          });

          const babelConfigPath = path.join(tempDir, 'babel.config.json');
          fs.writeFileSync(babelConfigPath, JSON.stringify(babelConfig, null, 2), 'utf-8');
          debugLog(`Created babel.config.json at ${babelConfigPath}`);

          // Try to find babel executable
          const babelPath = path.join(tempDir, 'node_modules', '.bin', 'babel');
          const babelCommand = process.platform === 'win32' ? `"${babelPath}"` : babelPath;

          // Execute babel
          const babelFullCommand = `${babelCommand} scraper.ts --out-file scraper.js --extensions ".ts"`;
          debugLog(`Executing: ${babelFullCommand}`);

          execSync(babelFullCommand, {
            cwd: tempDir,
            stdio: 'pipe',
            timeout: TIMEOUT_MS / 2
          });

          debugLog('Babel compilation successful');

          // Check if the compiled JavaScript file exists
          const jsFilePath = path.join(tempDir, 'scraper.js');
          if (!fs.existsSync(jsFilePath)) {
            throw new Error('Babel compilation completed but output file not found');
          }

          // Verify crawlee is available after Babel compilation
          const crawleePath = path.join(tempNodeModules, 'crawlee');
          if (!fs.existsSync(crawleePath)) {
            debugLog('Warning: crawlee not found after Babel compilation, but proceeding anyway');
          } else {
            debugLog('Babel compilation verification: crawlee found');
          }

          // Return success with the JavaScript file path
          return {
            success: true,
            outputPath: jsFilePath,
            tempDir
          };
    } catch (babelError: unknown) {
      const babelErrorMessage = babelError instanceof Error ? babelError.message : String(babelError);
      debugLog(`Babel compilation failed: ${babelErrorMessage}`);

      return {
        success: false,
        error: `Babel compilation failed: ${babelErrorMessage}`,
        tempDir
      };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog(`Error during TypeScript compilation: ${errorMessage}`);
    return {
      success: false,
      error: `Error during TypeScript compilation: ${errorMessage}`,
      tempDir
    };
  }
}

/**
 * Cleans up temporary files and directories
 * @param tempDir The temporary directory to clean up
 */
export async function cleanupCompilation(tempDir: string): Promise<void> {
  try {
    if (tempDir && fs.existsSync(tempDir)) {
      debugLog(`Cleaning up temporary directory: ${tempDir}`);
      await fsPromises.rm(tempDir, { recursive: true, force: true });
      debugLog(`Temporary directory removed: ${tempDir}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog(`Error cleaning up temporary directory: ${errorMessage}`);
  }
}
