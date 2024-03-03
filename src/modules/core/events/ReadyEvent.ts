import { Awaitable, Client } from 'discord.js';
import { ILog } from '../../../Global';
import { NSClient } from '../../../maylog/structures/MaylogClient';
import { MaylogClient } from '../../../maylog';
import Logger from '../../../util/Logger';
import MaylogEvent from '../../../maylog/structures/MaylogEvent';

export default class CoreReadyEvent extends MaylogEvent<'ready'> {
    public readonly name: string = 'CoreReady';
    public readonly code: NSClient.KeyofEvents = 'ready';
    constructor(client: MaylogClient) {
        super(client);
    }
    trigger(): (client: Client<true>) => Awaitable<void> {
        this.listener = async (client) => {
            if (process.platform === 'win32' && this.client.token === process.env.TOKEN_PRODUCTION) Logger.log(ILog.Level.Warning, 'Maylog', 'The **PRODUCTION** bot is in use.');
            Logger.log(ILog.Level.Info, `Maylog`, `Ready with ${client.guilds.cache.size} guilds.`);
            this.client.application!.commands.fetch(undefined, { cache: true, force: true }).catch(() => false);
        }
        return this.listener;
    }
}