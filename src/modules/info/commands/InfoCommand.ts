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
            description: 'Display information about mayLOG such as usage, statistics, and more.',
            module: 'info'
        });
    }
    async run(context: MaylogCommandContext) {
        const embed = new MessageEmbed()
            .setTitle('mayLOG Information')
            .setColor(Colors.fromString('mayLOG'))
            .setDescription(stripIndents`
                mayLOG is a Discord bot designed to assist departments with administrative functions, such as department actions, activity logs, action requests, and more.
                I'm also open source! You can see my [version 2](https://github.com/maylog-rbx/maylog) code, or my old [version 1](https://github.com/DevAX1T/mayLOG_V1) code.
            `)
            .setFields([
                { name: 'Bot Developer', value: 'devax1t#0 / [DevAX1T](https://roblox.com/users/125196014/profile)', inline: true },
                { name: 'Library', value: 'discord.js', inline: true },
                {
                    name: 'Usage/Documentation',
                    value: `[HackMD Documention](${Constants.docsLink})`,
                    inline: true
                },
                {
                    name: 'How do I use mayLOG?',
                    value: oneLine`
                    mayLOG is available for anyone to use, aimed at Roblox communities! Bot availability may vary as the server limit is capped at 100.
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
            const row = new MessageActionRow<MessageButton>().addComponents(DocumentationButton,  SupportServerButton);
        try {
            await context.reply({ embeds: [ embed ],components: [ row ] });
            return Promise.resolve(MaylogEnum.CommandResult.Success);
        } catch (error) {
            console.log(error);
            return Promise.resolve(MaylogEnum.CommandResult.Error);
        }
    }
}