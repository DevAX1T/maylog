import { MaylogCommand, MaylogEnum, MaylogClient } from '../../../maylog';
import { MaylogCommandContext } from '../../../maylog/structures/MaylogCommand';
import { MessageActionRow, MessageEmbed, Modal, TextInputComponent } from 'discord.js';
import * as Sentry from '@sentry/node';
import colors from '../../../databases/colors';
import emojis from '../../../databases/emojis';

export = class DiagnoseCommand extends MaylogCommand {
    constructor(client: MaylogClient) {
        super(client, {
            name: 'diagnose',
            description: 'Diagnose any issues with a command or a module.',
            module: 'core',
            cooldown: 5000,
            guildOnly: true,
            arguments: [
                {
                    name: 'command_or_module',
                    description: 'The command or module to diagnose.',
                    type: MaylogEnum.Argument.String,
                    autocomplete: true,
                    maxLength: 50,
                    optional: false
                }
            ]
        });
    }
    async run(context: MaylogCommandContext) {
        await context.deferReply();
        const invalidCommand = () => {
            context.editReply(`You have to provide a valid command or module. Try running the \`/help\` command. Keep in mind, you **have** to use a provided option.`)
                .catch(() => false);
            return Promise.resolve(MaylogEnum.CommandResult.Success);
        }
        const command_or_module = context.arguments.getString('command_or_module')!;
        const [ argModule, argCommand ] = command_or_module.split(':');
        if (!argModule) return invalidCommand();

        const guildData = await context.client.DataProvider.guilds.fetch(context.guild!.id);
        const issues = [];
        const info = [];
        const registry = this.client.Registry;
        let type!: `${string}: ${string}`;
        let id!: string;
        if (argCommand) {
            const command = this.client.Registry.commands.get(argCommand);
            if (!command) return invalidCommand();
            if (command.hide) return invalidCommand();
            type = `Command: ${command.name}`;
            id = `Command ID: ${command.module}:${command.name}`;
            info.push(`This command belongs to the \`${command.module}\` module.`);
            if (registry.disabledModules.has(command.module)) {
                issues.push(`The module the command belongs to is disabled.`);
            } else info.push('The module the command belongs to is enabled.');
            if (registry.disabledCommands.has(command.name)) {
                issues.push('This command is disabled by the bot developer.');
            } else {
                if (!registry.disabledModules.has(command.module)) info.push('This command is enabled.');
            }
            if (command.requiresGroupIntegration) {
                if (guildData.config.groupId === 0) {
                    issues.push(`This server is missing a configured Roblox group.`);
                } else {
                    if (!guildData.config.ranks) {
                        issues.push(`This server is missing configured Roblox group ranks (no roles are linked to a group rank)!`);
                    }
                }
            }
            if (command.requiresCommandRoles) {
                if (!guildData.config.roles.command.length) issues.push(`This server is missing configured command roles.`);
            }
            if (command.requiresHighCommandRoles) {
                if (!guildData.config.roles.high_command.length) issues.push(`This server is missing configured high command roles.`);
            }
            if (command.requiresLogChannel) {
                const missing: string[] = [];
                const typedef = {
                    log: 'Department Action Log',
                    loa: 'Leave of Absence Request',
                    actionRequest: 'Action Request',
                    activityLog: 'Activity Log'
                }
                command.requiresLogChannel.forEach(c => {
                    if (!guildData.config.channels[c]) missing.push((typedef as any)[c]);
                });
                missing.forEach(m => issues.push(`This server is missing a \`${m}\` channel.`));
            }
        } else {
            const module = this.client.Registry.modules.get(argModule);
            if (!module) return invalidCommand();
            type = `Module: ${module.name}`;
            id = `Module ID: ${module.id}`;
            info.push(`This module has \`${registry.commands.filter(c => c.module === module.id).size}\` commands.`);
            if (registry.disabledModules.has(module.id)) {
                issues.push(`This module is disabled by the bot developer`);
            } else info.push(`This module is enabled.`);
        }
        const embed = new MessageEmbed()
            .setColor(issues.length >= 1 ? colors.fromString('red') : colors.fromString('mayLOG'))
            .setTitle(type)
            .setDescription(`The diagnosis for \`${type.toLowerCase()}\` can be found below.`)
            .setFooter({ text: id })
            .setFields([
                { name: 'Information', value: info.join('\n') },
                { name: 'Issues', value: issues.length >= 1 ? issues.join('\n') : 'No issues.' }
            ]);
        context.editReply({ embeds: [ embed ] }).catch(() => false);
        return Promise.resolve(MaylogEnum.CommandResult.Success);
    }
}