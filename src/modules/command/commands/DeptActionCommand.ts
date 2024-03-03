import { ButtonInteraction, CacheType, GuildMember, GuildTextBasedChannel, Interaction, Message, MessageActionRow, MessageButton, MessageEmbed } from 'discord.js';
import { MaylogArgument, MaylogCommandContext } from '../../../maylog/structures/MaylogCommand';
import { MaylogClient, MaylogCommand, MaylogEnum, UserPermissions } from '../../../maylog';
import { randomUUID } from 'crypto';
import { stripIndents } from 'common-tags';
import * as Sentry from '@sentry/node';
import ActionOptions from '../../../databases/actionOptions';
import colors from '../../../databases/colors';
import Constants from '../../../Constants';
import DeptActionUtil from '../../../util/DeptActionUtil';
import emojis from '../../../databases/emojis';
import errors from '../../../databases/errors';

interface IRobloxData {
    username: string;
    user_id: number;
    avatarURL?: string;
    /** Discord account string */
    account?: string;
}

const subjectArgument: MaylogArgument = {
    name: 'subject',
    description: 'Who is subject to this action? (@Mention/Username/#UserId)',
    type: MaylogEnum.Argument.String
}
const noteArgument: MaylogArgument = {
    name: 'notes',
    description: 'What are the notes for this action?',
    type: MaylogEnum.Argument.String,
    optional: true
}
const commandArguments: MaylogArgument[] = [];

for (const actionId of Object.keys(ActionOptions)) {
    const action = ActionOptions[actionId];
    const argument: MaylogArgument = {
        name: actionId,
        description: action.description,
        type: MaylogEnum.Argument.Subcommand,
        arguments: []
    }
    if (!action.noSubject) argument.arguments!.push(subjectArgument);
    action.arguments?.forEach(arg => argument.arguments!.push(arg));
    if (!action.noNotes) argument.arguments!.push(noteArgument);

    if (argument!.arguments!.length === 0) delete argument.arguments;
    commandArguments.push(argument);
}

function getMessageLink(message: Message): string {
    return `https://discord.com/channels/${message.guild!.id}/${message.channel.id}/${message.id}`;
}

const actionSet = new Set<{ user: string, created: number}>();

function recordAction(userId: string): { user: string, created: number} | false {
    const entries = [...actionSet.values()].filter(e => e.user === userId);
    if (entries.length >= 5) return false;

    const ts = Date.now();
    const dataFormat = { user: userId, created: ts }
    actionSet.add(dataFormat);
    setTimeout(() => {
        actionSet.delete(dataFormat);
    }, 50000);
    return dataFormat;
}

export = class DeptActionCommand extends MaylogCommand {
    constructor(client: MaylogClient) {
        super(client, {
            name: 'deptaction',
            description: 'Log a department action.',
            module: 'command',
            guildOnly: true,
            arguments: commandArguments,
            channelPermissions: UserPermissions.EmbedLinks + UserPermissions.SendMessages,
            clientPermissions: UserPermissions.ManageRoles
        });
    }
    async run(context: MaylogCommandContext) {
        return new Promise<MaylogEnum.CommandResult>(async (_resolve) => {
            const recordedActionId = recordAction(context.author.id);
            if (!recordedActionId) {
                context.reply({ ephemeral: true, content: errors.PendingActions });
                return _resolve(MaylogEnum.CommandResult.Success);
            }
            const resolve = (code: number) => {
                actionSet.delete(recordedActionId);
                return _resolve(code);
            }
            await context.deferReply({ephemeral:true})
            const guilds = this.client.DataProvider.guilds;
            const subcommand = context.arguments.getSubcommand();
            const subject = context.arguments.getString('subject');
            const notes = context.arguments.getString('notes');

            const action = ActionOptions[subcommand as keyof typeof ActionOptions];
            const guildData = await guilds.fetch(context.guild!.id);
            if (!action) {
                context.editReply(stripIndents`
                    \`/deptaction ${subcommand}\` wasn't a recognized action. This is likely because of an issue with updating my commands.
                    Only the developer can fix this; for now, please use a different command, or in the worst case scenario, consider using \`/deptaction custom\`.
                `).catch(() => {});
                return resolve(MaylogEnum.CommandResult.Success);
            }
            let confirmMessage = `Please confirm if this is correct.`;

            // Fetch roblox username data
            let executorData: IRobloxData;
            let subjectData!: IRobloxData;

            if (!action.noSubject) {
                try {
                    subjectData = await DeptActionUtil.parseSubject(context, subject!);
                } catch (error) { // Don't log any errors - could be a purposeful invalid error!
                    context.editReply(errors.SubjectSearch).catch(() => false);
                    return resolve(MaylogEnum.CommandResult.Success);
                }
            }

            if (action.autoRole) {
                if (!subjectData.account) {
                    try {
                        subjectData.account = await DeptActionUtil.findAccount(context.guild!.id, subjectData.user_id);
                    } catch {
                        confirmMessage += `\n*Auto-role is enabled, but I wasn't able to find their Discord account. They will not be roled.*`;
                    }
                }
            }

            if (!action.noSubject && guildData.config.embedOptions.showAvatar) {
                try {
                    subjectData.avatarURL = await DeptActionUtil.getThumbnail(subjectData.user_id);
                } catch {
                    confirmMessage += `\n*I tried to get the avatar of the subject but I wasn't able to.*`;
                }
            }

            if (guildData.config.fetchExecutor) {
                try {
                    executorData = await DeptActionUtil.parseSubject(context, `<@${context.author.id}`);
                } catch {
                    confirmMessage += `\n*I couldn't get your Roblox information, so I'm using your server nickname instead.*`;
                    executorData = {
                        username: (context.author as GuildMember).nickname || context.author.displayName,
                        user_id: 0
                    }
                }
            } else {
                executorData = {
                    username: (context.author as GuildMember).nickname || context.author.displayName,
                    user_id: 0
                }
            }

            const embed = new MessageEmbed()
                .setTitle(guildData.config.embedOptions.title)
                .setFooter({
                    text: executorData.username,
                    iconURL: guildData.config.departmentIcon || context.guild!.iconURL() || Constants.defaultGuildIcon
                });
            let actionResult: string | void
            try {
                actionResult = action.exec({
                    context: context,
                    embed: embed,
                    guild: guildData,
                    subject: { username: subjectData ? subjectData!.username : '' }
                });
            } catch (error) {
                Sentry.captureException(error);
                context.editReply('An error occurred while trying to set the embed data!').catch(() => false);
                return resolve(MaylogEnum.CommandResult.Error);
            }
            if (typeof actionResult === 'string') {
                context.editReply(actionResult).catch(() => false);
                return resolve(MaylogEnum.CommandResult.Success);
            }
            if (notes) embed.addFields({ name: 'Notes', value: notes });

            const editReply = async (content: string, newEmbed: MessageEmbed[] = [], interaction?: ButtonInteraction) => {
                const response = { content: content, components: [], embeds: newEmbed }
                if (interaction) return interaction.update(response).catch(() => false);
                return context.editReply(response).catch(() => false);
            }
            const uuid = randomUUID();
            const ConfirmButton = new MessageButton()
                .setCustomId(`confirm-${uuid}`)
                .setLabel('Confirm')
                .setStyle('SUCCESS');
            const CancelButton = new MessageButton()
                .setCustomId(`cancel-${uuid}`)
                .setLabel('Cancel')
                .setStyle('DANGER');
            const row = new MessageActionRow<MessageButton>().addComponents(ConfirmButton, CancelButton);
            const promptMessage = await context.editReply({ content: confirmMessage, embeds: [ embed ], components: [ row ] });

            let isProcessed = false;
            let timeout!: NodeJS.Timeout;
            const continueProcess = (interaction: ButtonInteraction) => {
                isProcessed = true;
                this.client.removeListener('interactionCreate', listener);
                clearTimeout(timeout);
                if (interaction.customId === `cancel-${uuid}`) {
                    editReply('Interaction cancelled.', [], interaction);
                    return resolve(MaylogEnum.CommandResult.Success);
                }
                // Get the log channel
                const actionLogChannel = context.guild!.channels.cache.find(channel => {
                    const lc = guildData.config.channels.action;
                    if (lc) return guildData.config.channels.action === channel.id;
                    return channel.name === 'department-logs';

                }) as GuildTextBasedChannel | undefined;
                if (!actionLogChannel) {
                    editReply(errors.NoLogChannel, [], interaction);
                    return resolve(MaylogEnum.CommandResult.Success);
                }
                const hasPerms = actionLogChannel.permissionsFor(context.guild!.members.me!)
                    .has(UserPermissions.SendMessages + UserPermissions.EmbedLinks);
                if (!hasPerms) {
                    editReply(errors.NoPermissions, [], interaction);
                    return resolve(MaylogEnum.CommandResult.Success);
                }
                actionLogChannel.send({ embeds: [ embed ]}).then(async message => {
                    const messageLink = getMessageLink(message);
                    const sentEmbed = new MessageEmbed()
                        .setColor(colors.fromString('green'))
                        .setDescription(`${emojis.authorized} Action successfully logged: ${messageLink}`);
                    await interaction.update({ content: null, embeds: [ sentEmbed ], components: [] }).catch(() => {});
                    if (action.autoRole && guildData.config.autoRole) {
                        action.autoRole({
                            context: context,
                            embed: embed,
                            guild: guildData,
                            subject: { username: subjectData!.username },
                            executor: { username: executorData.username, user_id: executorData.user_id, account: (context.author as GuildMember) }
                        }).catch(error => {
                            interaction.followUp({ ephemeral: true, content: `I experienced an error while trying to auto-role the subject: ${error}` }).catch(() => false);
                        }).finally(() => resolve(MaylogEnum.CommandResult.Success));
                    } else return resolve(MaylogEnum.CommandResult.Success);
                }).catch(() => {
                    editReply('An unexpected error occurred and I was unable to log that action.', [], interaction);
                    return resolve(MaylogEnum.CommandResult.Error);
                });
            }
            function listener(interaction: Interaction<CacheType>) {
                if (!interaction.isButton()) return;
                if (interaction.user.id !== context.author.id) return;
                if (interaction.message.id !== promptMessage.id) return;
                continueProcess(interaction);
            }
            this.client.on('interactionCreate', listener);
            timeout = setTimeout(() => {
                if (!isProcessed) this.client.removeListener('interactionCreate', listener);
                editReply('The interaction has timed out.');
                resolve(MaylogEnum.CommandResult.Success)
            }, 30000);

            // return Promise.resolve(MaylogEnum.CommandResult.Success);
        });
    }
}