import { execSync } from 'child_process';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { debugLog } from './debug-logger';

export interface CompilerResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  tempDir?: string;
}

/**
 * Simple cleanup function (placeholder for compatibility)
 */
export async function forceCleanupSharedDependencies(): Promise<void> {
  debugLog('Simple cleanup - no shared dependencies to clean');
}

/**
 * Simple TypeScript compiler - no shared dependencies, just compile each script independently
 */
export async function compileTypeScriptScraper(
  scriptContent: string,
  options: { timeout?: number } = {}
): Promise<CompilerResult> {
  const TIMEOUT_MS = options.timeout || 300000; // 5 minutes default
  let tempDir: string | undefined;

  try {
    // Create temporary directory
    tempDir = path.join(os.tmpdir(), `ts-worker-${randomUUID()}`);
    await fsPromises.mkdir(tempDir, { recursive: true });
    debugLog(`Created temporary directory: ${tempDir}`);

    // Write TypeScript script
    const tsFilePath = path.join(tempDir, 'scraper.ts');
    await fsPromises.writeFile(tsFilePath, scriptContent, 'utf-8');
    debugLog(`TypeScript script written to ${tsFilePath}`);

    // Create package.json with all dependencies
    const packageJson = {
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
        "@supabase/supabase-js": "^2.0.0",
        "@babel/cli": "^7.0.0",
        "@babel/core": "^7.0.0",
        "@babel/preset-env": "^7.0.0",
        "@babel/preset-typescript": "^7.0.0"
      }
    };

    const packageJsonPath = path.join(tempDir, 'package.json');
    await fsPromises.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
    debugLog('Package.json created');

    // Install dependencies
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    debugLog('Installing dependencies...');
    
    try {
      const installResult = execSync(`${npmCommand} install --no-package-lock --no-save --prefer-offline --no-audit --no-fund`, {
        cwd: tempDir,
        stdio: 'pipe',
        timeout: TIMEOUT_MS,
        encoding: 'utf8'
      });
      debugLog('Dependencies installed successfully');
      debugLog(`Install output: ${installResult}`);
    } catch (installError: unknown) {
      const errorMessage = installError instanceof Error ? installError.message : String(installError);
      debugLog(`npm install failed: ${errorMessage}`);
      throw new Error(`Failed to install dependencies: ${errorMessage}`);
    }

    // Create babel.config.json
    const babelConfig = {
      presets: [
        "@babel/preset-env",
        "@babel/preset-typescript"
      ]
    };

    const babelConfigPath = path.join(tempDir, 'babel.config.json');
    await fsPromises.writeFile(babelConfigPath, JSON.stringify(babelConfig, null, 2), 'utf-8');
    debugLog('Babel config created');

    // Compile with Babel
    const babelPath = path.join(tempDir, 'node_modules', '.bin', 'babel');
    const babelCommand = process.platform === 'win32' ? `"${babelPath}.cmd"` : `"${babelPath}"`;
    const jsFilePath = path.join(tempDir, 'scraper.js');

    debugLog('Compiling TypeScript with Babel...');
    try {
      execSync(`${babelCommand} scraper.ts --out-file scraper.js --extensions ".ts"`, {
        cwd: tempDir,
        stdio: 'pipe',
        timeout: TIMEOUT_MS / 2
      });
      debugLog('Babel compilation successful');
    } catch (babelError: unknown) {
      const errorMessage = babelError instanceof Error ? babelError.message : String(babelError);
      debugLog(`Babel compilation failed: ${errorMessage}`);
      throw new Error(`Babel compilation failed: ${errorMessage}`);
    }

    // Verify output file exists
    if (!fs.existsSync(jsFilePath)) {
      throw new Error('Compilation completed but output file not found');
    }

    debugLog(`Compilation successful: ${jsFilePath}`);
    return {
      success: true,
      outputPath: jsFilePath,
      tempDir
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog(`Compilation error: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
      tempDir
    };
  }
}

/**
 * Clean up temporary files and directories
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
