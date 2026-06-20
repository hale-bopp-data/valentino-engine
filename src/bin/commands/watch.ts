import { resolve } from 'path';
import { watchFile, formatWatchEvent } from '../../core/watch.js';

export function runWatch(args: string[]): void {
    const file = args.find(a => !a.startsWith('-'));
    if (!file) {
        console.error('Usage: valentino watch <file|directory>');
        process.exit(1);
    }

    const resolved = resolve(file);
    console.log(`Watching ${resolved} for changes... (Ctrl+C to stop)`);

    const watcher = watchFile(resolved, {
        onEvent: event => {
            console.log(formatWatchEvent(event));
        },
    });

    process.on('SIGINT', () => {
        watcher.close();
        console.log('\nWatch stopped.');
        process.exit(0);
    });
}
