import { CacheType, GuildMember } from 'discord.js';
import Module from '../Module';
import { MaylogCommandContext } from '../../maylog/structures/MaylogCommand';
import { MaylogClient } from '../../maylog';
import Global from '../../Global';

export default class EmployeeModule extends Module {
    public readonly isEnabled = true;
    constructor(client: MaylogClient) {
        super('employee', client);
    }
    async guard_preExecution(context: MaylogCommandContext<CacheType>): Promise<[result: boolean, message?: string | undefined]> {
        if (!context.command.guildOnly || !context.guild) return Promise.resolve([ true ]);

        try {
            const guildData = await context.client.DataProvider.guilds.fetch(context.guild!.id);
            const departmentRole = guildData.config.roles.department;
            if (!departmentRole) {
                return Promise.resolve([ false, 'This server didn\'t configure a department role. As a result, you\'re unable to use this command.' ]);
            }
            if (!(context.author as GuildMember).roles.cache.has(departmentRole)) {
                const role = context.guild!.roles.cache.get(departmentRole);
                return Promise.resolve([ false, `You aren't an employee! You need the \`${role?.name || 'deleted role'}\` to use this command.` ]);
            }
            return Promise.resolve([ true ]);
        } catch (error) {
            return Promise.reject(error);
        }
    }
}