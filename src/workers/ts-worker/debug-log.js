// Simple debug script to check if the worker is running with our changes
import fs from 'fs';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file path
const logFile = path.join(logsDir, 'debug.log');

// Log function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  
  // Append to log file
  fs.appendFileSync(logFile, logMessage);
}

// Log startup
log('Debug script started');

// Check if the worker is running with our changes
const workerFile = path.join(__dirname, 'dist', 'index.js');
if (fs.existsSync(workerFile)) {
  const stats = fs.statSync(workerFile);
  log(`Worker file exists. Last modified: ${stats.mtime}`);
  
  // Read the first 1000 characters of the file to check for our changes
  const content = fs.readFileSync(workerFile, 'utf8').substring(0, 1000);
  log(`Worker file content preview: ${content.substring(0, 100)}...`);
  
  // Check for our changes
  if (content.includes('errorDetailsObj')) {
    log('Worker file contains our changes!');
  } else {
    log('Worker file does NOT contain our changes!');
  }
} else {
  log('Worker file does not exist!');
}

// Log environment
log(`Node version: ${process.version}`);
log(`Current directory: ${__dirname}`);
log(`Environment variables: ${Object.keys(process.env).join(', ')}`);

// Exit
log('Debug script completed');
