import { Awaitable } from 'discord.js';
import MaylogClient, { NSClient } from './MaylogClient';

export default class MaylogEvent<K extends NSClient.KeyofEvents> {
    /** Fire the event only once? */
    public readonly once: boolean = false;
    /** The event that triggers */
    public readonly code!: NSClient.KeyofEvents;
    /** Unique name for the event */
    public readonly name!: string;
    public readonly client: MaylogClient;

    /** Listener function for the event */
    public listener!: ((...args: NSClient.MaylogClientEvents[K]) => Awaitable<void>) | undefined
    constructor(client: MaylogClient) {
        // if (!this.name) throw new Error('Name was not provided for event class');
        // if (!this.code) throw new Error(`Event code was not provided for event class ${this.name}`);
        this.client = client;
    }
    trigger(): (...args: NSClient.MaylogClientEvents[K]) => Awaitable<void> {
        this.listener = (...args: NSClient.MaylogClientEvents[K]) => {
            // idek
            throw new Error(`Default event function was not set for ${this.name}_${this.code}`);
        }
        return this.listener;
    }
}