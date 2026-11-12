// Keep large catalog contexts out of OS command-line arguments. This launcher
// preserves the scraper's existing CLI, including require.main semantics.
import fs from 'fs';
import Module from 'module';

const [scriptPath, contextPath] = process.argv.slice(2);
if (!scriptPath || !contextPath) throw new Error('Missing scraper/context file');
process.argv = [process.execPath, scriptPath, 'scrape', '--context', fs.readFileSync(contextPath, 'utf8')];
(Module as unknown as { runMain(path: string): void }).runMain(scriptPath);
