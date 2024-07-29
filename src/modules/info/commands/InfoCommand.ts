import { MaylogCommand, MaylogClient, MaylogEnum } from '../../../maylog';
import { MaylogCommandContext } from '../../../maylog/structures/MaylogCommand';
import { MessageActionRow, MessageButton, MessageEmbed } from 'discord.js';
import { oneLine, stripIndents } from 'common-tags';
import Colors from '../../../databases/colors';
import Constants from '../../../Constants';
import Global from '../../../Global';
import PrettyMilliseconds from '../../../util/PrettyMilliseconds';

export = class InfoCommand extends MaylogCommand {
    constructor(client: MaylogClient) {
        super(client, {
            name: 'info',
            description: 'Display information about ActionLOG such as usage, statistics, and more.',
            module: 'info'
        });
    }
    async run(context: MaylogCommandContext) {
        const embed = new MessageEmbed()
            .setTitle('ActionLOG Information')
            .setColor(Colors.fromString('ActionLOG'))
            .setDescription(stripIndents`
                ActionLOG is a Discord bot designed to assist departments with administrative functions, such as department actions, activity logs, action requests, and more.
                I'm also open source! You can see my [version 2](https://github.com/DevAX1T/mayLOG) code, or my old [version 1](https://github.com/DevAX1T/mayLOG_V1) code.
            `)
            .setFields([
                { name: 'Bot Developer', value: 'devax1t#0 / [DevAX1T](https://roblox.com/users/125196014/profile)', inline: true },
                { name: 'Library', value: 'discord.js', inline: true },
                {
                    name: 'Usage/Documentation',
                    value: `[HackMD Documention](${Constants.docsLink})`,
                    inline: true
                },
                // {
                //     name: 'Legal',
                //     value: '[Terms of Service/Privacy Policy](https://hackmd.io/@DevAX1T/BJTrwV3u0)',
                //     inline: true
                // },
                {
                    name: 'How do I use ActionLOG?',
                    value: oneLine`
                    ActionLOG is available for anyone to use, aimed at Roblox communities!
                    More information can be found in the [documentation](${Constants.docsLink}).`
                },
                { name: 'Version', value: `\`v${Constants.packageJSON.version}\``, inline: true },
                { name: 'Process Uptime', value: PrettyMilliseconds(Math.floor(process.uptime() * 1000), { verbose: true }), inline: true },
                {
                    name: 'Guilds',
                    value: `${Global.currency(this.client.guilds.cache.size, true)} guilds; ${Global.currency(this.client.users.cache.size, true)} users`,
                    inline: true
                }
            ]);
            const DocumentationButton = new MessageButton()
                .setLabel('Documentation')
                .setStyle('LINK')
                .setURL(Constants.docsLink);
            const SupportServerButton = new MessageButton()
                .setLabel('Support Server')
                .setStyle('LINK')
                .setURL(Constants.supportInvite);
            const ToS = new MessageButton()
                .setLabel('Terms of Service/Privacy Policy')
                .setStyle('LINK')
                .setURL('https://hackmd.io/@DevAX1T/BJTrwV3u0')
            const row = new MessageActionRow<MessageButton>().addComponents(DocumentationButton,  SupportServerButton, ToS);
        try {
            await context.reply({ embeds: [ embed ],components: [ row ] });
            return Promise.resolve(MaylogEnum.CommandResult.Success);
        } catch (error) {
            console.log(error);
            return Promise.resolve(MaylogEnum.CommandResult.Error);
        }
    }
}