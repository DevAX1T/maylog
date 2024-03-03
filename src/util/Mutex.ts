/**Constructs a mutex.*/
export default class Mutex {
    private readonly queue: (() => void)[] = [];
    private _isLocked: boolean = false;
    public isLocked(): boolean {
        return this._isLocked;
    }
    /** Does not ever reject. */
    public async acquire(id: string): Promise<void> {
        return new Promise(resolve => {
            if (!this._isLocked) {
                this._isLocked = true;
                resolve();
            } else this.queue.push(resolve);
        });
    }
    public async release(id: string) {
        if (this.queue.length > 0) {
            const _next = this.queue.shift();
            _next?.();
        } else this._isLocked = false;
    }
}