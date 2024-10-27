import { Awaitable, Guild, GuildTextBasedChannel, MessageEmbed } from 'discord.js';
import { MaylogClient } from '../../../../maylog';
import { NSClient } from '../../../../maylog/structures/MaylogClient';
import * as Sentry from '@sentry/node';
import colors from '../../../../databases/colors';
import Constants from '../../../../Constants';
import MaylogEvent from '../../../../maylog/structures/MaylogEvent';


export default class GuildCreateLogEvent extends MaylogEvent<'guildCreate'> {
    public readonly name: string = 'GuildCreateLogEvent';
    public readonly code: NSClient.KeyofEvents = 'guildCreate';
    constructor(client: MaylogClient) {
        super(client);
    }
    trigger(): (guild: Guild) => Awaitable<void> {
        this.listener = async (guild) => {
            try {
                let hasRover
                try {
                    await guild.members.fetch({ user: Constants.RoVer_Bot_ID, force: true });
                    hasRover = true;
                } catch {
                    hasRover = false;
                    guild.leave().catch(() => false);
                    return; // todo: if actionlog comes back, make future commands error instead "rover must be added for me to work"
                }
                const embed = new MessageEmbed()
                .setTitle('Guild Created')
                .setDescription('A guild has been created.')
                .setColor(colors.fromString('green'))
                .addFields([
                    { name: 'Guild Name', value: guild.name, inline: true },
                    { name: 'Guild ID', value: `\`${guild.id}\``, inline: true },
                    { name: 'Guild Membercount', value: `\`${guild.members.cache.size}\``, inline: true },
                    { name: 'Owner', value: `\`${guild.ownerId}\`` },
                    { name: 'Has RoVer', value: `\`${hasRover}\`` }
                ]);
            (this.client.channels.cache.get(Constants.logs.guild_logs)! as GuildTextBasedChannel).send({ embeds: [ embed ] }).catch((e) => {console.log(e); return false});
            } catch (error) {
                console.log(error);
                Sentry.captureException(error);
            }
        }
        return this.listener;
    }
}