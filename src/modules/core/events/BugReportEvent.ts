import { Awaitable, CacheType, GuildTextBasedChannel, Interaction, MessageEmbed } from 'discord.js';
import { MaylogClient } from '../../../maylog';
import { NSClient } from '../../../maylog/structures/MaylogClient';
import * as Sentry from '@sentry/node';
import colors from '../../../databases/colors';
import Constants from '../../../Constants';
import MaylogEvent from '../../../maylog/structures/MaylogEvent';

export default class BugReportEvent extends MaylogEvent<'interactionCreate'> {
    public readonly name: string = 'BugReportEvent';
    public readonly code: NSClient.KeyofEvents = 'interactionCreate';
    constructor(client: MaylogClient) {
        super(client);
    }
    trigger(): (interaction: Interaction<CacheType>) => Awaitable<void> {
        this.listener = async (interaction) => {
            if (!interaction.isModalSubmit()) return;
            if (interaction.customId !== 'bug-report') return;
            interaction.deferReply({ ephemeral: true });
            const content = interaction.fields.getTextInputValue('content');
            try {
                const channel = interaction.client.guilds.cache.get(Constants.logs.guild_id)!.channels.cache.get(Constants.logs.bug_reports) as GuildTextBasedChannel;
                if (!channel) {
                    interaction.editReply('I wasn\'t able to send this bug report to the developer.');
                    return;
                }
                const embed = new MessageEmbed()
                    .setColor(colors.fromString('mayLOG'))
                    .setTitle('Bug Report')
                    .setDescription('A new bug report was received')
                    .setTimestamp(Date.now())
                    .addFields([
                        { name: 'Author', value: `\`${interaction.user.username}\` / \`${interaction.user.id}\``},
                        { name: 'Report', value: `\`\`\`${content.replace('```', '\`\`\`')}\`\`\`` }
                    ]);
                channel.send({ embeds: [ embed ] }).then(() => {
                    interaction.editReply('Your bug report was sent!').catch(() => false);
                }).catch(() => {
                    interaction.editReply('An error occurred. Your bug report was not sent.').catch(() => false);
                });
            } catch (error) {
                Sentry.captureException(error);
                interaction.editReply('An error occurred and I wasn\'t able to submit the bug report.').catch(() => false);
            }

        }
        return this.listener;
    }
}