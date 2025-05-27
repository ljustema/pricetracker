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
interface CompilerResult {
  success: boolean;
  outputPath: string | null;
  error?: string;
  tempDir?: string;
}

/**
 * Validate shared dependencies cache
 */
async function validateSharedDependencies(): Promise<boolean> {
  try {
    const nodeModulesPath = path.join(SHARED_DEPS_DIR, 'node_modules');
    const packageJsonPath = path.join(SHARED_DEPS_DIR, 'package.json');

    // Check if basic structure exists
    if (!fs.existsSync(nodeModulesPath) || !fs.existsSync(packageJsonPath)) {
      debugLog('Shared dependencies structure missing');
      return false;
    }

    // Check for critical dependencies
    const criticalDeps = ['typescript', 'yargs', 'fast-xml-parser'];
    for (const dep of criticalDeps) {
      const depPath = path.join(nodeModulesPath, dep);
      if (!fs.existsSync(depPath)) {
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
      } catch (readError) {
        debugLog('Failed to read Crawlee type definitions');
        return false;
      }
    }

    debugLog('Shared dependencies validation passed');
    return true;
  } catch (error: any) {
    debugLog(`Shared dependencies validation failed: ${error.message}`);
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
  } catch (error: any) {
    debugLog(`Failed to cleanup shared dependencies: ${error.message}`);
  }
}

/**
 * Initialize shared dependencies to reduce memory usage
 */
async function initializeSharedDependencies(): Promise<void> {
  if (sharedDepsInitialized) {
    // Validate existing cache
    const isValid = await validateSharedDependencies();
    if (!isValid) {
      debugLog('Existing shared dependencies are corrupted, reinitializing...');
      await cleanupSharedDependencies();
      sharedDepsInitialized = false;
    } else {
      return;
    }
  }

  try {
    debugLog('Initializing shared dependencies cache...');

    // Create shared dependencies directory
    await fsPromises.mkdir(SHARED_DEPS_DIR, { recursive: true });

    // Create package.json for shared dependencies with more conservative versions
    const packageJson = {
      name: "ts-worker-shared-deps",
      version: "1.0.0",
      private: true,
      dependencies: {
        // Use more stable versions to avoid type definition issues
        "typescript": "^5.0.0",
        "@types/node": "^18.15.0",
        "yargs": "^17.6.2",
        "fast-xml-parser": "^5.2.0",
        "node-fetch": "^2.6.7",
        "jsdom": "^21.1.0"
        // Note: Crawlee and Playwright will be installed per-compilation to avoid type issues
      }
    };

    const packageJsonPath = path.join(SHARED_DEPS_DIR, 'package.json');
    await fsPromises.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');

    // Install dependencies once
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    debugLog('Installing shared dependencies (one-time setup)...');

    execSync(`${npmCommand} install --no-package-lock --no-save`, {
      cwd: SHARED_DEPS_DIR,
      stdio: 'pipe',
      timeout: 300000 // 5 minutes timeout
    });

    // Validate installation
    const isValid = await validateSharedDependencies();
    if (!isValid) {
      throw new Error('Shared dependencies validation failed after installation');
    }

    sharedDepsInitialized = true;
    debugLog('Shared dependencies cache initialized successfully');
  } catch (error: any) {
    debugLog(`Failed to initialize shared dependencies: ${error.message}`);
    // Clean up failed installation
    await cleanupSharedDependencies();
    sharedDepsInitialized = false;
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

  // Initialize shared dependencies first
  await initializeSharedDependencies();

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

    // Create a hybrid approach: use shared dependencies for stable packages, install problematic ones individually
    debugLog('Setting up dependencies with hybrid approach...');

    // Create package.json for this compilation
    const packageJson = {
      name: "temp-scraper-execution",
      version: "1.0.0",
      private: true,
      dependencies: {
        "crawlee": "^3.13.3",
        "playwright": "^1.30.0",
        "node-fetch": "^2.6.7",
        "jsdom": "^21.1.0",
        "yargs": "^17.6.2",
        "typescript": "^5.0.0",
        "@types/node": "^18.15.0",
        "fast-xml-parser": "^5.2.0"
      }
    };

    const packageJsonPath = path.join(tempDir, 'package.json');
    await fsPromises.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
    debugLog(`Created package.json at ${packageJsonPath}`);

    // Try to use shared dependencies for stable packages
    const tempNodeModules = path.join(tempDir, 'node_modules');
    await fsPromises.mkdir(tempNodeModules, { recursive: true });

    if (sharedDepsInitialized && await validateSharedDependencies()) {
      debugLog('Using shared dependencies for stable packages...');

      const sharedNodeModules = path.join(SHARED_DEPS_DIR, 'node_modules');
      const stablePackages = ['typescript', 'yargs', 'fast-xml-parser', 'node-fetch', 'jsdom', '@types'];

      // Copy stable packages from shared cache
      for (const pkg of stablePackages) {
        const sharedPkgPath = path.join(sharedNodeModules, pkg);
        const tempPkgPath = path.join(tempNodeModules, pkg);

        if (fs.existsSync(sharedPkgPath)) {
          try {
            if (process.platform === 'win32') {
              // On Windows, use robocopy for better performance
              execSync(`robocopy "${sharedPkgPath}" "${tempPkgPath}" /E /NFL /NDL /NJH /NJS /NC /NS`, { stdio: 'pipe' });
            } else {
              // On Unix-like systems, use cp
              execSync(`cp -r "${sharedPkgPath}" "${tempPkgPath}"`, { stdio: 'pipe' });
            }
            debugLog(`Copied shared package: ${pkg}`);
          } catch (copyError: any) {
            debugLog(`Failed to copy shared package ${pkg}: ${copyError.message}`);
          }
        }
      }
    }

    // Install all dependencies (will use existing ones where available)
    debugLog('Installing remaining dependencies...');
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    try {
      execSync(`${npmCommand} install --no-package-lock --no-save`, {
        cwd: tempDir,
        stdio: 'pipe',
        timeout: 300000 // 5 minutes timeout for npm install
      });
      debugLog('Dependencies installed successfully');
    } catch (installError: any) {
      debugLog(`npm install failed: ${installError.message}`);
      throw new Error(`Failed to install dependencies: ${installError.message}`);
    }

    // Create a tsconfig.json file with very permissive settings to effectively skip type checking
    const tsConfigContent = {
      compilerOptions: {
        target: "ES2020",
        module: "CommonJS",
        moduleResolution: "Node",
        esModuleInterop: true,
        skipLibCheck: true, // Skip type checking of declaration files
        resolveJsonModule: true,
        outDir: ".",
        allowSyntheticDefaultImports: true,
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
        skipDefaultLibCheck: true, // Skip checking .d.ts files included with TypeScript
        incremental: false, // Disable incremental compilation for faster one-time builds
        composite: false, // Disable composite project features
        declaration: false, // Don't generate declaration files
        declarationMap: false, // Don't generate declaration source maps
        sourceMap: false // Don't generate source maps for faster compilation
      },
      include: ["scraper.ts"],
      exclude: ["node_modules"]
    };

    const tsConfigPath = path.join(tempDir, 'tsconfig.json');
    await fsPromises.writeFile(tsConfigPath, JSON.stringify(tsConfigContent, null, 2), 'utf-8');
    debugLog(`Created tsconfig.json at ${tsConfigPath}`);

    // Compile using tsc from node_modules
    debugLog('Compiling TypeScript using local tsc');

    try {
      // Try to find the tsc executable
      let tscPath = path.join(tempDir, 'node_modules', '.bin', 'tsc');
      let tscCommand = process.platform === 'win32' ? `"${tscPath}"` : tscPath;

      // Check if the tsc executable exists
      try {
        await fsPromises.access(tscPath);
        debugLog(`Found tsc at ${tscPath}`);
      } catch (_accessError) {
        // If not found in .bin, try the typescript/bin directory
        debugLog(`tsc not found at ${tscPath}, trying alternative location`);
        tscPath = path.join(tempDir, 'node_modules', 'typescript', 'bin', 'tsc');
        tscCommand = process.platform === 'win32' ? `"${tscPath}"` : tscPath;

        try {
          await fsPromises.access(tscPath);
          debugLog(`Found tsc at ${tscPath}`);
        } catch (_accessError2) {
          // If still not found, try using npx
          debugLog(`tsc not found at ${tscPath}, falling back to npx`);
          tscCommand = 'npx tsc';
        }
      }

      // Execute the TypeScript compiler
      debugLog(`Executing: ${tscCommand}`);

      // We need to specify the input file explicitly
      // Note: TypeScript compiler doesn't have a --transpileOnly flag (that's a ts-node feature)
      // Instead, we rely on the tsconfig.json settings to effectively skip type checking
      const fullCommand = `${tscCommand} scraper.ts`;
      debugLog(`Full command: ${fullCommand}`);

      try {
        // Execute the TypeScript compiler using execSync
        debugLog(`Executing TypeScript compiler in ${tempDir}`);

        // Run the TypeScript compiler
        execSync(fullCommand, {
          cwd: tempDir,
          stdio: 'pipe',
          timeout: TIMEOUT_MS / 2 // Use half the timeout for compilation
        });

        // Check if the compiled JavaScript file exists
        const jsFilePath = path.join(tempDir, 'scraper.js');
        if (!fs.existsSync(jsFilePath)) {
          throw new Error('TypeScript compilation completed but output file not found');
        }

        debugLog(`TypeScript compilation successful, output file: ${jsFilePath}`);

        // Return success with the JavaScript file path
        return {
          success: true,
          outputPath: jsFilePath,
          tempDir
        };
      } catch (tscError) {
        const errorMessage = tscError instanceof Error ? tscError.message : String(tscError);
        debugLog(`Error during TypeScript compilation: ${errorMessage}`);

        // Check if the error has stderr property (from execSync)
        if (tscError && typeof tscError === 'object' && 'stderr' in tscError && tscError.stderr) {
          debugLog(`TypeScript compilation stderr: ${tscError.stderr}`);
        }

        // Check if the error has stdout property (from execSync)
        if (tscError && typeof tscError === 'object' && 'stdout' in tscError && tscError.stdout) {
          debugLog(`TypeScript compilation stdout: ${tscError.stdout}`);
        }

        // Try using Babel as a fallback
        debugLog('TypeScript compilation failed, trying Babel as fallback');

        try {
          // Create a babel.config.json file
          const babelConfig = {
            presets: [
              "@babel/preset-env",
              "@babel/preset-typescript"
            ]
          };

          // Install Babel dependencies if not already in package.json
          debugLog('Installing Babel dependencies');
          execSync('npm install --no-package-lock --no-save @babel/cli @babel/core @babel/preset-env @babel/preset-typescript', {
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

          // Return success with the JavaScript file path
          return {
            success: true,
            outputPath: jsFilePath,
            tempDir
          };
        } catch (babelError) {
          const babelErrorMessage = babelError instanceof Error ? babelError.message : String(babelError);
          debugLog(`Babel compilation failed: ${babelErrorMessage}`);

          // If both TypeScript and Babel fail, return the original TypeScript error
          return {
            success: false,
            outputPath: null,
            error: errorMessage,
            tempDir
          };
        }
      }
    } catch (tscError: any) {
      let errorMessage = tscError.message;
      let stderrOutput = '';

      // Try to extract the stderr output
      if (tscError.stderr) {
        stderrOutput = tscError.stderr.toString().trim();
        debugLog(`Compilation errors:\n${stderrOutput}`);
        errorMessage = stderrOutput || errorMessage;
      }

      // If stderr is empty, just use the error message directly
      if (!stderrOutput && tscError.message) {
        errorMessage = tscError.message;
        debugLog(`Error message: ${errorMessage}`);
      }

      return {
        success: false,
        outputPath: null,
        error: `TypeScript compilation failed: ${errorMessage}`,
        tempDir
      };
    }
  } catch (error: any) {
    debugLog(`Error during TypeScript compilation: ${error.message}`);
    return {
      success: false,
      outputPath: null,
      error: `Error during TypeScript compilation: ${error.message}`,
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
  } catch (error: any) {
    debugLog(`Error cleaning up temporary directory: ${error.message}`);
  }
}
