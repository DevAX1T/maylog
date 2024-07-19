import { MaylogCommand, MaylogEnum, MaylogClient } from '../../../maylog';
import { MaylogCommandContext } from '../../../maylog/structures/MaylogCommand';
import { MessageActionRow, Modal, TextInputComponent } from 'discord.js';
import * as Sentry from '@sentry/node';

export = class DeveloperCommand extends MaylogCommand {
    constructor(client: MaylogClient) {
        super(client, {
            name: 'bug_report',
            description: 'Report a bug with ActionLOG.',
            module: 'core',
            cooldown: 60000 * 5
        });
    }
    async run(context: MaylogCommandContext) {
        const contentComponent = new TextInputComponent()
            .setCustomId('content')
            .setLabel('Bug Details')
            .setStyle('PARAGRAPH')
            .setPlaceholder('Please be as detailed in your report as possible.')
            .setMaxLength(850)
            .setMinLength(10);
        const contentRow = new MessageActionRow<TextInputComponent>().addComponents(contentComponent);
        const modal = new Modal()
            .setCustomId('bug-report')
            .setTitle('Bug Report')
            .addComponents(contentRow);
        try {
            await context.interaction.showModal(modal);
        } catch (error) {
            Sentry.captureException(error);
            context.editReply({ content: 'An error occurred while trying to show you the bug report modal.' });
            return Promise.resolve(MaylogEnum.CommandResult.Error);
        }
        return Promise.resolve(MaylogEnum.CommandResult.Success);
    }
}