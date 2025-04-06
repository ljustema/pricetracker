const { CheerioCrawler, RequestQueue, Dataset, Configuration, log } = require('crawlee');
const { MemoryStorage } = require('@crawlee/memory-storage');

(async () => {
    try {
        log.info('Initializing MemoryStorage...');
        const storageClient = new MemoryStorage({ persistStorage: false });
        const configuration = new Configuration({ storageClient });

        log.info('Opening RequestQueue...');
        const queue = await RequestQueue.open();

        log.info('Adding dummy request...');
        await queue.addRequest({ url: 'https://example.com' });

        log.info('Creating CheerioCrawler...');
        const crawler = new CheerioCrawler({
            requestQueue: queue,
            maxRequestsPerCrawl: 1,
            async requestHandler({ request, $ }) {
                log.info(`Visited: ${request.url}`);
            },
        });

        log.info('Running crawler...');
        await crawler.run();

        log.info('Opening Dataset...');
        const dataset = await Dataset.open();
        const data = await dataset.getData();
        log.info(`Dataset contains ${data.items.length} items.`);

        log.info('Test completed successfully.');
    } catch (error) {
        log.error('Test failed:', error);
        process.exit(1);
    }
})();