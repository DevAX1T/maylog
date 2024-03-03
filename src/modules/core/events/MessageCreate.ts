import { Awaitable, Message } from 'discord.js';
import { MaylogClient } from '../../../maylog';
import { NSClient } from '../../../maylog/structures/MaylogClient';
import { stripIndents } from 'common-tags';
import Constants from '../../../Constants';
import MaylogEvent from '../../../maylog/structures/MaylogEvent';

export default class MessageCreateEvent extends MaylogEvent<'messageCreate'> {
    public readonly name: string = 'CoreHelp';
    public readonly code: NSClient.KeyofEvents = 'messageCreate';
    constructor(client: MaylogClient) {
        super(client);
    }
    trigger(): (message: Message<boolean>) => Awaitable<void> {
        this.listener = async (message) => {
            const mention = `<@${this.client.user!.id}>`;
            if (message.content.replace('!', '') !== mention) return;
            // const helpId = this.client.application!.commands.cache.find(c => c.name === 'help')?.id
            // const helpCommand = helpId ? `</help:${helpId}>` : 'the `/help` command';
            // const diagnoseId = this.client.application!.commands.cache.find(c => c.name === 'diagnose')?.id;
            // const diagnoseCommand = diagnoseId ? `</diagnose:${diagnoseId}>` : 'the `/diagnose` command';
            // const infoId = this.client.application!.commands.cache.find(c => c.name === 'info')?.id;
            // const infoCommand = infoId ? `</info:${infoId}>` : 'the `/info` command';
            message.reply(stripIndents`
                Hello! I am mayLOG, a bot designed to assist with department management. I'm also open source! Run ${this.client.getCommandString('info')} for more information!
                My documentation can be found [here](${Constants.docsLink}).
                If you're experiencing any issues with me, you can run ${this.client.getCommandString('diagnose')}. If you want to see a list of commands, run ${this.client.getCommandString('help')}!
            `).catch(() => false);
        }
        return this.listener;
    }
}