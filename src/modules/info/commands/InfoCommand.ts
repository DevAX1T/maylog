import { MaylogCommand, MaylogClient, MaylogEnum } from '../../../maylog';
import { MaylogCommandContext } from '../../../maylog/structures/MaylogCommand';
import { MessageActionRow, MessageButton, MessageEmbed } from 'discord.js';
import { oneLine, stripIndents } from 'common-tags';
import Colors from '../../../databases/colors';
import Constants from '../../../Constants';
import Global from '../../../Global';
import PrettyMilliseconds from '../../../util/PrettyMilliseconds';
import colors from '../../../databases/colors';

const IS_DISABLED = true;

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
            if (IS_DISABLED) {
                const discontinueEmbed = new MessageEmbed()
                    .setTitle('Discontinuation Notice')
                    .setColor(colors.fromString('red'))
                    .setDescription(stripIndents`
                        ActionLOG will be closing its doors by 2024-11-07 as cluggas, a Clark County Moderator, has deceived administrators into believing that the owner of the bot, namely DevAX1T, has harrassed community members, resulting in his community removal.

                        I do not wish to pay the hosting for a community that does not trust me. The bot was only up for Clark, which is the only large/notable ro-state that continues to use ActionLOG. **If I somehow missed a large community that is/plans to use ActionLOG, please do contact me.**

                        There will no doubt be alternatives; you are encouraged to explore them. Regardless, be cautious and, ideally, ensure the bot is verified by Discord to discourage abuse.

                        **(TLDR: sued a moderator and got him [prosecuted](https://trello.com/c/Bw1y8cfG/168-state-of-mayflower-v-cluggas). he gets me banned as revenge)**

                        Best wishes,
                        DevAX1T
                    `)
                    .addFields([
                        {
                            name: 'Evidence (of conduct by cluggas)',
                            value: stripIndents`
                                [Full recording of DMs](https://youtu.be/IUJ1qlTCfdY)
                                [Cluggas shooting me - which is why he is being prosecuted](https://youtu.be/VKDKGQnfX84?si=unAO3oFR2xmrq4vv&t=835)
                                [Cluggas insulting me for telling him not to erase evidence used in a lawsuit](https://imgur.com/a/JCoqsJt)
                                [Cluggas's attempt to provoke me](https://imgur.com/a/hL4N9sD)
                                [Cluggas using DMs to further provoke me](https://imgur.com/a/toGYB0f)
                                [Cluggas himself bringing this to the point of harassment](https://imgur.com/a/yBHcNae)
                            `
                        }
                    ]);
                context.followUp({ embeds: [ discontinueEmbed ]}).catch(() => {});
            }
            return Promise.resolve(MaylogEnum.CommandResult.Success);
        } catch (error) {
            console.log(error);
            return Promise.resolve(MaylogEnum.CommandResult.Error);
        }
    }
}