import { Awaitable, Guild } from 'discord.js';
import { ILog } from '../../../../Global';
import { MaylogClient } from '../../../../maylog';
import { NSClient } from '../../../../maylog/structures/MaylogClient';
import { stripIndents } from 'common-tags';
import Logger from '../../../../util/Logger';
import MaylogEvent from '../../../../maylog/structures/MaylogEvent';

export default class GuildDataCreateEvent extends MaylogEvent<'guildCreate'> {
    public readonly name: string = 'GuildDataCreateEvent';
    public readonly code: NSClient.KeyofEvents = 'guildCreate';
    constructor(client: MaylogClient) {
        super(client);
    }
    trigger(): (guild: Guild) => Awaitable<void> {
        this.listener = async (guild) => {
            this.client.DataProvider.guilds.fetch(guild.id).then(async data => {
                if (data.blacklist) {
                    try {
                        const owner = await guild.fetchOwner();
                        await owner.send(stripIndents`
                            I was invited to your server by an administrator, howevever, this server is blacklisted:
                            \`${data.blacklist}\`
                        `)
                    } catch {};
                    guild.leave()
                        .then(() => Logger.log(ILog.Level.Info, 'Core', `Left blacklisted guild ${guild.id}`))
                        .catch(() => Logger.log(ILog.Level.Error, 'Core', `Failed to leave blacklisted guild ${guild.id}`));
                } else {
                    this.client.Statistics.guildJoin();
                    Logger.log(ILog.Level.Info, 'Core', `Guild created for ${guild.id}`);
                }
            }).catch(() => false);
        }
        return this.listener;
    }
}