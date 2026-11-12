import { StringDecoder } from 'string_decoder';

export class KeyedTasks {
  private pending = new Map<string, Promise<unknown>>();
  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(key) || Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    this.pending.set(key, next);
    try { return await next; }
    finally { if (this.pending.get(key) === next) this.pending.delete(key); }
  }
}

export class OrderedLines {
  private decoder = new StringDecoder('utf8');
  private buffer = '';
  private pending: Promise<void> = Promise.resolve();
  constructor(private handler: (line: string) => Promise<void>) {}
  push(chunk: Buffer): Promise<void> {
    this.pending = this.pending.then(async () => {
      this.buffer += this.decoder.write(chunk);
      let boundary: number;
      while ((boundary = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, boundary);
        this.buffer = this.buffer.slice(boundary + 1);
        await this.handler(line);
      }
    });
    return this.pending;
  }
  finish(): Promise<void> {
    this.pending = this.pending.then(async () => {
      this.buffer += this.decoder.end();
      if (this.buffer) await this.handler(this.buffer);
      this.buffer = '';
    });
    return this.pending;
  }
}
