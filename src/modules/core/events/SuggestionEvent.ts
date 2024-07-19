import { Awaitable, CacheType, GuildTextBasedChannel, Interaction, MessageEmbed } from 'discord.js';
import { MaylogClient } from '../../../maylog';
import { NSClient } from '../../../maylog/structures/MaylogClient';
import * as Sentry from '@sentry/node';
import colors from '../../../databases/colors';
import Constants from '../../../Constants';
import MaylogEvent from '../../../maylog/structures/MaylogEvent';

export default class SuggestionEvent extends MaylogEvent<'interactionCreate'> {
    public readonly name: string = 'SuggestionEvent';
    public readonly code: NSClient.KeyofEvents = 'interactionCreate';
    constructor(client: MaylogClient) {
        super(client);
    }
    trigger(): (interaction: Interaction<CacheType>) => Awaitable<void> {
        this.listener = async (interaction) => {
            if (!interaction.isModalSubmit()) return;
            if (interaction.customId !== 'suggestion') return;
            interaction.deferReply({ ephemeral: true });
            const content = interaction.fields.getTextInputValue('content');
            try {
                const channel = interaction.client.guilds.cache.get(Constants.logs.guild_id)!.channels.cache.get(Constants.logs.suggestions) as GuildTextBasedChannel;
                if (!channel) {
                    interaction.editReply('I wasn\'t able to send this suggestion to the developer.');
                    return;
                }
                const embed = new MessageEmbed()
                    .setColor(colors.fromString('ActionLOG'))
                    .setTitle('Suggestion')
                    .setDescription('A new suggestion was received')
                    .setTimestamp(Date.now())
                    .addFields([
                        { name: 'Author', value: `\`${interaction.user.username}\` / \`${interaction.user.id}\``},
                        { name: 'Suggestion', value: `\`\`\`${content.replace('```', '\`\`\`')}\`\`\`` }
                    ]);
                channel.send({ embeds: [ embed ] }).then(() => {
                    interaction.editReply('Your suggestion was sent!').catch(() => false);
                }).catch(() => {
                    interaction.editReply('An error occurred. Your suggestion was not sent.').catch(() => false);
                });
            } catch (error) {
                Sentry.captureException(error);
                interaction.editReply('An error occurred and I wasn\'t able to submit the suggestion.').catch(() => false);
            }

        }
        return this.listener;
    }
}