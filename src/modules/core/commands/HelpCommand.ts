import { MaylogCommand, MaylogClient, MaylogEnum } from '../../../maylog';
import { MaylogCommandContext } from '../../../maylog/structures/MaylogCommand';
import { MessageEmbed } from 'discord.js';
import { stripIndents } from 'common-tags';
import Colors from '../../../databases/colors';
import Constants from '../../../Constants';
import colors from '../../../databases/colors';
import CachedCollection from '../../../util/CachedCollection';

const IS_DISABLED = true;
const cache = new CachedCollection((60 * 1000) * 1);

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
            if (IS_DISABLED && !cache.has(context.author.id)) {
                cache.set(context.author.id, true);
                const discontinueEmbed = new MessageEmbed()
                    .setTitle('Discontinuation Notice')
                    .setColor(colors.fromString('red'))
                    .setDescription(stripIndents`
                        ActionLOG will be closing its doors by 2024-11-07 as cluggas, a Clark County Moderator, has deceived administrators into believing that the owner of the bot, namely DevAX1T, has harrassed community members, resulting in his community removal.

                        I do not wish to pay the hosting for a community that does not trust me. The bot was only up for Clark, which is the only large/notable ro-state that continues to use ActionLOG. **If I somehow missed a large community that is/plans to use ActionLOG, please do contact me.**

                        There will no doubt be alternatives; you are encouraged to explore them. Regardless, be cautious and, ideally, ensure the bot is verified by Discord to discourage abuse.

                        **(TLDR: sued a moderator and got him [prosecuted](https://trello.com/c/Bw1y8cfG/168-state-of-mayflower-v-cluggas). he gets me banned as revenge)**

                        -# Other people may view this information by running ${this.client.getCommandString('info')} or ${this.client.getCommandString('help')}
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
                                [Owner brawladdie taking part in this](https://imgur.com/a/RpRkqzH)
                                (brawladdie has ghosted me during this; lame_memes refuses to intervene)
                            `
                        }
                    ]);
                context.followUp({ embeds: [ discontinueEmbed ]}).catch(() => {});
            }
            return Promise.resolve(MaylogEnum.CommandResult.Success);
        } catch {
            return Promise.resolve(MaylogEnum.CommandResult.Error);
        }
    }
}