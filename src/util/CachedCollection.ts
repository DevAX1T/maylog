import { Collection } from 'discord.js';

/** Cached collection that deletes itself after a specified time period */
export = class CachedCollection<K, V> extends Collection<K, V> {
    private cache: Record<string, NodeJS.Timeout> = {};
    public defaultMs: number = 15000;
    constructor(defaultMs: number) {
        super()
        this.defaultMs = defaultMs;
    }
    extend(key: K, ms: number): void {
        if (this.cache[key as string]) clearTimeout(this.cache[key as string]);

        this.cache[key as string] = setTimeout(() => {
            clearTimeout(this.cache[key as string]);
            delete this.cache[key as string];
            super.delete(key);
        }, ms);
    }
    clear(): void {
        for (const timeout of Object.values(this.cache)) {
            clearTimeout(timeout);
        }

        return super.clear();
    }
    set(key: K, value: V, ms: number = this.defaultMs): this {
        if (this.cache[key as string]) clearTimeout(this.cache[key as string]);

        this.cache[key as string] = setTimeout(() => {
            clearTimeout(this.cache[key as string]);
            delete this.cache[key as string];
            super.delete(key);
        }, ms);

        return super.set(key, value);
    }
    delete(key: K): boolean {
        if (this.cache[key as string]) {
            clearTimeout(this.cache[key as string]);
            delete this.cache[key as string];
        }

        return super.delete(key);
    }
}