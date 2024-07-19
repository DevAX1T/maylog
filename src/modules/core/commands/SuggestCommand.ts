import { MaylogCommand, MaylogEnum, MaylogClient } from '../../../maylog';
import { MaylogCommandContext } from '../../../maylog/structures/MaylogCommand';
import { MessageActionRow, Modal, TextInputComponent } from 'discord.js';
import * as Sentry from '@sentry/node';

export = class DeveloperCommand extends MaylogCommand {
    constructor(client: MaylogClient) {
        super(client, {
            name: 'suggest',
            description: 'Suggest a feature for ActionLOG.',
            module: 'core',
            cooldown: 60000 * 5
        });
    }
    async run(context: MaylogCommandContext) {
        const contentComponent = new TextInputComponent()
            .setCustomId('content')
            .setLabel('Suggestion Details')
            .setStyle('PARAGRAPH')
            .setPlaceholder('Please be as detailed in your suggestion as possible.')
            .setMaxLength(850)
            .setMinLength(10);
        const contentRow = new MessageActionRow<TextInputComponent>().addComponents(contentComponent);
        const modal = new Modal()
            .setCustomId('suggestion')
            .setTitle('Suggestion')
            .addComponents(contentRow);
        try {
            await context.interaction.showModal(modal);
        } catch (error) {
            Sentry.captureException(error);
            context.editReply({ content: 'An error occurred while trying to show you the suggestion modal.' });
            return Promise.resolve(MaylogEnum.CommandResult.Error);
        }
        return Promise.resolve(MaylogEnum.CommandResult.Success);
    }
}