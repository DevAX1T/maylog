import { Awaitable, Guild, GuildTextBasedChannel, MessageEmbed } from 'discord.js';
import { MaylogClient } from '../../../../maylog';
import { NSClient } from '../../../../maylog/structures/MaylogClient';
import * as Sentry from '@sentry/node';
import colors from '../../../../databases/colors';
import Constants from '../../../../Constants';
import MaylogEvent from '../../../../maylog/structures/MaylogEvent';


export default class GuildDeleteLogEvent extends MaylogEvent<'guildCreate'> {
    public readonly name: string = 'GuildDeleteLogEvent';
    public readonly code: NSClient.KeyofEvents = 'guildCreate';
    constructor(client: MaylogClient) {
        super(client);
    }
    trigger(): (guild: Guild) => Awaitable<void> {
        this.listener = async (guild) => {
            try {
                const embed = new MessageEmbed()
                .setTitle('Guild Created')
                .setDescription('A guild has been deleted.')
                .setColor(colors.fromString('red'))
                .addFields([
                    { name: 'Guild Name', value: guild.name, inline: true },
                    { name: 'Guild ID', value: `\`${guild.id}\``, inline: true },
                    { name: 'Guild Membercount', value: `\`${guild.members.cache.size}\``, inline: true },
                    { name: 'Owner', value: `\`${guild.ownerId}\`` },
                ]);
            (this.client.channels.cache.get(Constants.logs.guild_logs)! as GuildTextBasedChannel).send({ embeds: [ embed ] }).catch((e) => {
                console.log(e); return false});
            } catch (error) {
                console.log(error);
                Sentry.captureException(error);
            }
        }
        return this.listener;
    }
}