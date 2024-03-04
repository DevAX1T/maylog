import { CommandInteraction, GuildMember, GuildTextBasedChannel, TextChannel } from 'discord.js';
import { MaylogCommandContext } from '../MaylogCommand';
import { MaylogEnum } from '../..';
import { ILog } from '../../../Global';
import * as Sentry from '@sentry/node';
import chalk, { Chalk } from 'chalk';
import Dispatcher from './Dispatcher';
import Logger from '../../../util/Logger';
import PrettyMilliseconds from '../../../util/PrettyMilliseconds';

const cooldowns = new Map<string, number>();

export = (dispatcher: Dispatcher, interaction: CommandInteraction) => {
    const command = dispatcher.Registry.commands.get(interaction.commandName);
    if (!command) return interaction.reply('An error occurred: command does not exist. Report this error to developers if this issue persists.');
    if (dispatcher.Registry.disabledCommands.has(interaction.commandName)) {
        return interaction.reply({ ephemeral: true, content: 'This command is currently disabled by the developer.' });
    }

    let optionalContext: any = {};
    if (interaction.guild) optionalContext.guild = interaction.guild;
    const CommandContext: MaylogCommandContext = Object.assign({}, optionalContext, {
        command: command!,
        interaction: interaction,
        author: interaction.member as GuildMember || interaction.user,
        client: dispatcher.client,
        arguments: interaction.options as any,
        deferReply(options): any {
            return interaction.deferReply(options);
        },
        deleteReply(message) {
            return interaction.deleteReply(message);
        },
        editReply(options) {
            return interaction.editReply(options);
        },
        fetchReply(options) {
            return interaction.fetchReply(options);
        },
        followUp(options) {
            return interaction.followUp(options);
        },
        reply(options): any {
            return interaction.reply(options);
        },
        /**
         * Safe replies or safe edit replies (just checks if you can reply and does that).
         * @important Rejects with 'not repliable' if you are unable to reply.
         */
        safeReply(options) {
            if (!interaction.isRepliable()) return Promise.reject('not repliable');
            if (interaction.replied) return interaction.editReply(options);
            return interaction.reply(options);
        }
    } as MaylogCommandContext)
    
    try {
        const cooldown = cooldowns.get(`${interaction.user.id}/${command.name}`);
        if (cooldown) {
            if (Date.now() < cooldown) {
                return interaction.reply({
                    ephemeral: true,
                    content: `You are on cooldown. Wait ${PrettyMilliseconds(cooldown - Date.now(), { verbose: true })} before using this command again.`
                });
            } else cooldowns.delete(`${interaction.user.id}/${command.name}`);
        }
        let baseSuccessMessage = `Ran slash command (${command.module}:${command.name}) for ${interaction.user.id}`;
        baseSuccessMessage += ` in ${interaction.guild ? `GUILD (${interaction.guild.id}, ${interaction.channel!.id})` : `DM (${interaction.channel!.id})`}`;
        if (dispatcher.client.Registry.disabledModules.has(command.module)) {
            return interaction.reply({ ephemeral: true, content: 'This module has been disabled by the developer.' });
        }

        // check permissions
        const channel = interaction.channel;
        if (command.clientPermissions) {
            const permissions = interaction.guild!.members.me!.permissions.missing(command.clientPermissions);
            if (permissions.length > 0) return interaction.reply({
                ephemeral: true,
                content: `I cannot run this command. I'm missing the following permissions: ${permissions.map(m => `\`${m}\``).join(', ')}`
            });
        }
        if (channel && command.channelPermissions) {
            const permissions = interaction.guild!.members.me!.permissionsIn(channel as GuildTextBasedChannel)
            const missing = permissions.missing(command.channelPermissions);
            if (missing.length > 0) return interaction.reply({
                ephemeral: true,
                content: `I cannot run this command. I'm missing the following channel permissions: ${missing.map(m => `\`${m}\``).join(', ')}`
            });
        }

        const module = command.getModule()!;
        module.guard_preExecution(CommandContext).then(async preExecutionResult => {
            if (preExecutionResult[0]) {
                try {
                    const [ prelimStatus, prelimMessage ] = await command.preExecution(CommandContext);
                    if (!prelimStatus) interaction.reply({ ephemeral: true, content: prelimMessage }).catch(() => {});
                } catch(error) {
                    Sentry.captureException(error);
                    interaction.reply({ ephemeral: true, content: 'An error occurred. Please try again.' }).catch(() => {});
                }
                command.run(CommandContext).then(executionResult => {
                    interaction.client.Statistics.commandRun(interaction.user, command);
                    const zcer = MaylogEnum.CommandResult;
                    if (executionResult === zcer.Success && command.cooldown) {
                        cooldowns.set(`${interaction.user.id}/${command.name}`, Date.now() + command.cooldown);
                        setTimeout(() => cooldowns.delete(`${interaction.user.id}/${command.name}`), command.cooldown + 1000); // Just a backup
                    }
                    const colors: Record<number, Chalk> = { [zcer.Success]: chalk.green, [zcer.PartialSuccess]: chalk.yellow, [zcer.Error]: chalk.red };
                    const enumName = MaylogEnum.CommandResult[executionResult];
                    Logger.log(ILog.Level.DebugExtended, 'Maylog', `${colors[executionResult](`[${enumName}]`)} ${baseSuccessMessage}`);

                    module.guard_postExecution(CommandContext, executionResult).then(() => {
                        Logger.log(ILog.Level.DebugExtended, 'Maylog', `Ran post execution for command (${command.module}:${command.name}) for ${interaction.user.id}`);
                    }).catch(error => {
                        Sentry.captureException(error);
                        Logger.log(ILog.Level.Error, 'Maylog', `Failed to postExec-run (/) command '${command.name} for '${interaction.user.id}'. Error data: ${error}`);
                    });
                }).catch(error => {
                    Logger.log(ILog.Level.Error, 'Maylog', `${chalk.red('[ERROR]')} ${baseSuccessMessage} Error data: ${error}`);
                    Sentry.captureException(error);
                });
            } else {
                // False
                const message = preExecutionResult[1];
                CommandContext.reply({ ephemeral: true, content: message ?? 'There was an error running the command. This module is likely disabled.' })
                    .catch(Sentry.captureException);
            }
        }).catch(error => {
            Logger.log(ILog.Level.Error, 'Dispatcher', `Failed to pre-execute command ${command.module}:${command.name} for ${interaction.user.id}`);
            Sentry.captureException(error);
            CommandContext.reply({ ephemeral: true, content: 'An error occurred while trying to execute this command.' }).catch(() => false);
        });
    } catch (error) {
        Sentry.captureException(error);
        Logger.log(ILog.Level.Error, 'Maylog', `Failed to preliminary-run (/) command '${command.name} for '${interaction.user.id}'. Error data: ${error}`);
        if (!interaction.replied) interaction.reply({ ephemeral: true, content: 'An error occurred. Please try again.' });
    }
}