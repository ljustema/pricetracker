#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const SHARED_DEPS_DIR = path.join(os.tmpdir(), 'ts-worker-shared-deps');

console.log('Cleaning up corrupted shared dependencies...');
console.log(`Target directory: ${SHARED_DEPS_DIR}`);

if (fs.existsSync(SHARED_DEPS_DIR)) {
  try {
    fs.rmSync(SHARED_DEPS_DIR, { recursive: true, force: true });
    console.log('✅ Corrupted shared dependencies removed successfully');
  } catch (error) {
    console.error('❌ Failed to remove shared dependencies:', error.message);
    process.exit(1);
  }
} else {
  console.log('ℹ️  Shared dependencies directory does not exist');
}

console.log('✅ Cleanup complete. The worker will create a fresh cache on next run.');
