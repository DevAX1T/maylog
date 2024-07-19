import { MaylogCommand, MaylogClient, MaylogEnum } from '../../../maylog';
import { MaylogCommandContext } from '../../../maylog/structures/MaylogCommand';
import { MessageEmbed } from 'discord.js';
import { stripIndents } from 'common-tags';
import Colors from '../../../databases/colors';
import Constants from '../../../Constants';

export = class HelpCommand extends MaylogCommand {
    constructor(client: MaylogClient) {
        super(client, {
            name: 'help',
            description: 'Get help with ActionLOG.',
            module: 'core',
            cooldown: 2000
        }); 
    } 
    async run(context: MaylogCommandContext) {
        const embed = new MessageEmbed()
            .setTitle('ActionLOG Help')
            .setColor(Colors.fromString('ActionLOG'))
            .setDescription(stripIndents`
                I have no prefix; I use slash commands. To find my commands, simply press \`/\` and look at what pops up!
                If you encounter any issues, you can always run ${this.client.getCommandString('diagnose')} which will show you the potential issues with a command.
                I'm also open source! You can run ${this.client.getCommandString('info')} for more information!
            `)
            .setFields([
                {
                    name: 'Usage/Documentation',
                    value: `[HackMD Documention](${Constants.docsLink})`,
                    inline: true
                },
                {
                    name: 'Support Server',
                    value: Constants.supportInvite,
                    inline: true
                },
            ]);
        try {
            await context.reply({ embeds: [ embed ] });
            return Promise.resolve(MaylogEnum.CommandResult.Success);
        } catch {
            return Promise.resolve(MaylogEnum.CommandResult.Error);
        }
    }
}