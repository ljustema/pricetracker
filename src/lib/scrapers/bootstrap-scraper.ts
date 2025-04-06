import { MemoryStorage } from '@crawlee/memory-storage';
import { Configuration } from 'crawlee';

// Create explicit MemoryStorage configuration
const storageClient = new MemoryStorage({ persistStorage: false });
const configuration = new Configuration({ storageClient });

// Monkey-patch Crawlee's global configuration singleton
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
Configuration.globalConfig = configuration;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
Configuration.getGlobal = () => configuration;

import { runNorrmalmselScraper } from './norrmalmsel-crawler';

(async () => {
    try {
        await runNorrmalmselScraper();
    } catch (error) {
        console.error('Scraper failed:', error);
        process.exit(1);
    }
})();