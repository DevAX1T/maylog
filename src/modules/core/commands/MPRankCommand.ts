import { GuildMember, MessageAttachment } from 'discord.js';
import { MaylogCommand, MaylogEnum, MaylogClient, UserPermissions } from '../../../maylog';
import { MaylogCommandContext } from '../../../maylog/structures/MaylogCommand';
import Constants from '../../../Constants';
import DeptActionUtil from '../../../util/DeptActionUtil';
import Global from '../../../Global';
import noblox from 'noblox.js';

const LETI_GROUP = 15146042;
const MP_RANK = 236;
const CERTIFIED_RANK = 232;

export = class MPRankCommand extends MaylogCommand {
    constructor(client: MaylogClient) {
        super(client, {
            name: 'mprank',
            description: 'Rank a user MP (or demote to Certified)',
            module: 'core',
            guildOnly: true,
            hide: true,
            manualGuildRollout: [ Constants.logs.guild_id, '1207143131410075668' ], // MP Server
            userPermissions: UserPermissions.Administrator,
            cooldown: 1000,
            arguments: [
                {
                    name: 'subject',
                    description: 'The guardsman to rank.',
                    type: MaylogEnum.Argument.String
                },
            ]
        });
    }
    async run(context: MaylogCommandContext) {
        if (!(context.author as GuildMember).permissions.has('ADMINISTRATOR')) {
            context.reply({ ephemeral: true, content: 'You have no authority to run this command.' });
            return Promise.resolve(MaylogEnum.CommandResult.Success);
        }
        await context.deferReply({ ephemeral: true });
        const subject = context.arguments.getString('subject')!;
        const user = await DeptActionUtil.parseSubject(context, subject);
        const userRank = await noblox.getRankInGroup(LETI_GROUP, user.user_id);
        if (![ MP_RANK, CERTIFIED_RANK ].includes(userRank)) {
            context.editReply('The subject must hold the `Military Police` or `Certified` rank.').catch(() => false);
            return Promise.resolve(MaylogEnum.CommandResult.Success);
        }
        const targetRank = userRank === CERTIFIED_RANK ? MP_RANK : CERTIFIED_RANK;
        const result = await noblox.setRank(LETI_GROUP, user.user_id, targetRank);
        context.editReply({ content: `Set user rank to \`${result.name}\`.` }).catch(() => false);
        return Promise.resolve(MaylogEnum.CommandResult.Success);
    }
}