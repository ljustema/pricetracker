#!/usr/bin/env node

/**
 * Memory Test Script for TS-Worker
 * 
 * This script tests the memory usage of the optimized ts-worker
 * to verify that the memory optimizations are working correctly.
 */

const { spawn } = require('child_process');
const path = require('path');

function formatMemory(bytes) {
  return Math.round(bytes / 1024 / 1024) + 'MB';
}

function logMemory(context) {
  const usage = process.memoryUsage();
  console.log(`[${context}] RSS: ${formatMemory(usage.rss)}, Heap: ${formatMemory(usage.heapUsed)}/${formatMemory(usage.heapTotal)}, External: ${formatMemory(usage.external)}`);
  return usage;
}

async function testWorkerMemory() {
  console.log('🧪 Testing TS-Worker Memory Usage...\n');
  
  // Test 1: Check startup memory
  console.log('📊 Test 1: Startup Memory Usage');
  console.log('Starting ts-worker and monitoring initial memory...');
  
  const workerPath = path.join(__dirname, 'dist', 'index.js');
  const worker = spawn('node', ['--expose-gc', workerPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'test' }
  });
  
  let startupMemory = null;
  let memoryReadings = [];
  let startTime = Date.now();
  
  // Monitor worker output
  worker.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('WORKER:', output.trim());
    
    // Look for memory logs
    const memoryMatch = output.match(/\[MEMORY\] Worker startup: RSS=(\d+)MB/);
    if (memoryMatch) {
      startupMemory = parseInt(memoryMatch[1]);
      console.log(`✅ Startup memory detected: ${startupMemory}MB`);
    }
    
    // Collect all memory readings
    const allMemoryMatches = output.match(/\[MEMORY\].*RSS=(\d+)MB/g);
    if (allMemoryMatches) {
      allMemoryMatches.forEach(match => {
        const rss = parseInt(match.match(/RSS=(\d+)MB/)[1]);
        memoryReadings.push({
          time: Date.now() - startTime,
          rss: rss,
          context: match.match(/\[MEMORY\] ([^:]+):/)[1]
        });
      });
    }
  });
  
  worker.stderr.on('data', (data) => {
    console.log('WORKER ERROR:', data.toString().trim());
  });
  
  // Wait for startup to complete
  await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
  
  // Kill the worker
  worker.kill('SIGTERM');
  
  // Wait for worker to exit
  await new Promise(resolve => {
    worker.on('exit', resolve);
    setTimeout(() => {
      worker.kill('SIGKILL');
      resolve();
    }, 5000);
  });
  
  console.log('\n📈 Memory Analysis Results:');
  console.log('=' .repeat(50));
  
  if (startupMemory !== null) {
    console.log(`🚀 Startup Memory: ${startupMemory}MB`);
    
    if (startupMemory <= 100) {
      console.log('✅ EXCELLENT: Startup memory is under 100MB');
    } else if (startupMemory <= 300) {
      console.log('⚠️  GOOD: Startup memory is under 300MB but could be better');
    } else if (startupMemory <= 800) {
      console.log('⚠️  WARNING: Startup memory is high (300-800MB)');
    } else {
      console.log('❌ CRITICAL: Startup memory is very high (>800MB)');
    }
  } else {
    console.log('❌ Could not detect startup memory from logs');
  }
  
  if (memoryReadings.length > 0) {
    console.log('\n📊 Memory Readings Timeline:');
    memoryReadings.forEach(reading => {
      const timeStr = (reading.time / 1000).toFixed(1) + 's';
      console.log(`  ${timeStr.padStart(6)} | ${reading.rss.toString().padStart(4)}MB | ${reading.context}`);
    });
    
    const maxMemory = Math.max(...memoryReadings.map(r => r.rss));
    const avgMemory = Math.round(memoryReadings.reduce((sum, r) => sum + r.rss, 0) / memoryReadings.length);
    
    console.log(`\n📈 Peak Memory: ${maxMemory}MB`);
    console.log(`📊 Average Memory: ${avgMemory}MB`);
    
    if (maxMemory <= 200) {
      console.log('✅ EXCELLENT: Peak memory usage is very low');
    } else if (maxMemory <= 500) {
      console.log('✅ GOOD: Peak memory usage is acceptable');
    } else if (maxMemory <= 1000) {
      console.log('⚠️  WARNING: Peak memory usage is getting high');
    } else {
      console.log('❌ CRITICAL: Peak memory usage is too high');
    }
  }
  
  console.log('\n🎯 Optimization Targets:');
  console.log('  • Startup memory: < 100MB (target: ~50MB)');
  console.log('  • Peak memory: < 300MB (target: ~200MB)');
  console.log('  • Memory should return to baseline after operations');
  
  console.log('\n✨ Memory test completed!');
}

// Test 2: Check package.json dependencies
function testDependencies() {
  console.log('\n📦 Test 2: Dependency Analysis');
  console.log('Checking package.json for heavy dependencies...');
  
  try {
    const packageJson = require('./package.json');
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};
    
    console.log('Production dependencies:', Object.keys(dependencies));
    console.log('Dev dependencies:', Object.keys(devDependencies));
    
    // Check for heavy dependencies that should be removed
    const heavyDeps = ['crawlee', 'playwright', '@supabase/supabase-js', 'jsdom', 'node-fetch'];
    const foundHeavyDeps = heavyDeps.filter(dep => 
      dependencies[dep] || devDependencies[dep]
    );
    
    if (foundHeavyDeps.length === 0) {
      console.log('✅ EXCELLENT: No heavy dependencies found in package.json');
    } else {
      console.log('❌ WARNING: Found heavy dependencies that should be lazy-loaded:');
      foundHeavyDeps.forEach(dep => console.log(`  - ${dep}`));
    }
    
    // Check for --expose-gc flag
    const startScript = packageJson.scripts?.start || '';
    if (startScript.includes('--expose-gc')) {
      console.log('✅ GOOD: --expose-gc flag is enabled for garbage collection');
    } else {
      console.log('⚠️  WARNING: --expose-gc flag not found in start script');
    }
    
  } catch (error) {
    console.log('❌ Could not read package.json:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🔬 TS-Worker Memory Optimization Test Suite');
  console.log('=' .repeat(50));
  
  testDependencies();
  await testWorkerMemory();
  
  console.log('\n🏁 All tests completed!');
  console.log('\nIf you see high memory usage, check:');
  console.log('1. Heavy dependencies in package.json');
  console.log('2. Lazy loading implementation');
  console.log('3. Shared dependency cache initialization');
  console.log('4. Memory cleanup after operations');
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
});

// Run the tests
runTests().catch(console.error);
