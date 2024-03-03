import { CacheType, GuildMember } from 'discord.js';
import { MaylogClient } from '../../maylog';
import { MaylogCommandContext } from '../../maylog/structures/MaylogCommand';
import Constants from '../../Constants';
import Module from '../Module';

export = class ConfigurationModule extends Module {
    constructor(client: MaylogClient) {
        super('config', client);
    }
    async guard_preExecution(context: MaylogCommandContext<CacheType>): Promise<[result: boolean, message?: string | undefined]> {
        if (!context.command.guildOnly || !context.guild) return Promise.resolve([ true ]);
        if ((context.author as GuildMember).permissions.has('MANAGE_GUILD')) return Promise.resolve([ true ]);

        try {
            const guildData = await context.client.DataProvider.guilds.fetch(context.guild!.id);
            const commandRoles = guildData.config.roles.command.concat(guildData.config.roles.high_command);
            if (commandRoles.length === 0) {
                return Promise.resolve([
                    false,
                    `You cannot run this command - the server has no command roles setup. Please do so by [reading the documentation](${Constants.docsLink})!`
                ]);
            }
            if (!(context.author as GuildMember).roles.cache.hasAny(...commandRoles)) {
                return Promise.resolve([ false, 'You don\'t have a department command role. As a result, you\'re unable to use this command.' ]);
            }
            return Promise.resolve([ true ]);
        } catch (error) {
            return Promise.reject(error);
        }
    }
}