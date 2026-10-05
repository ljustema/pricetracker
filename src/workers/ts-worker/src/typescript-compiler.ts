import { execFileSync } from 'child_process';
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
 * Compile each script in its own temporary directory using the worker's locked dependencies
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

    // Reuse the dependencies installed by npm ci for this deployment. Installing
    // floating ranges for each run bypassed our lockfile and pulled in a timeout
    // regression that retained parsed pages until the scraper exhausted its heap.
    // The script and storage still live in an isolated, disposable directory.
    const nodeModulesPath = path.dirname(path.dirname(require.resolve('crawlee/package.json')));
    await fsPromises.symlink(
      nodeModulesPath,
      path.join(tempDir, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    await fsPromises.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'temp-scraper', version: '1.0.0', private: true, type: 'commonjs' }),
      'utf-8'
    );
    debugLog('Using deployment-locked scraper dependencies');

    // Create babel.config.json
    const babelConfig = {
      presets: [
        require.resolve('@babel/preset-env'),
        require.resolve('@babel/preset-typescript')
      ]
    };

    const babelConfigPath = path.join(tempDir, 'babel.config.json');
    await fsPromises.writeFile(babelConfigPath, JSON.stringify(babelConfig, null, 2), 'utf-8');
    debugLog('Babel config created');

    // Compile with Babel
    const babelPath = require.resolve('@babel/cli/bin/babel.js');
    const jsFilePath = path.join(tempDir, 'scraper.js');

    debugLog('Compiling TypeScript with Babel...');
    try {
      execFileSync(process.execPath, [babelPath, tsFilePath, '--out-file', jsFilePath, '--extensions', '.ts', '--config-file', babelConfigPath], {
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
