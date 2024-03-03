import { CacheType } from 'discord.js';
import Module from '../Module';
import { MaylogCommandContext } from '../../maylog/structures/MaylogCommand';
import { MaylogClient } from '../../maylog';
import Global from '../../Global';

export default class InfoModule extends Module {
    public readonly isEnabled = true;
    constructor(client: MaylogClient) {
        super('info', client);
    }
}