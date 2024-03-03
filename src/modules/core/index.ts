import { CacheType, CommandInteraction, Guild } from 'discord.js';
import Module from '../Module';
import { MaylogCommandContext } from '../../maylog/structures/MaylogCommand';
import { MaylogClient } from '../../maylog';
import Constants from '../../Constants';

export = class CoreModule extends Module {
    constructor(client: MaylogClient) {
        super('core', client);
        // this.client.Registry.disabledCommands.add('zdev');
    }
}