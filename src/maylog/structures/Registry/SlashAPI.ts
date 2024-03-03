import { Collection } from 'discord.js';
import { MaylogArgument } from '../MaylogCommand';
import { MaylogEnum } from '../../../maylog';
import { SlashCommandBuilder } from '@discordjs/builders';
import MaylogCommand from '../MaylogCommand';

/**
 * @param  {Collection<string} commands
 * @param  {} MaylogCommand>
 * @param  {SlashCommandBuilder[]} targetArray
 * @param  {boolean} includeManual Include commands which are manual guild-only commands?
 */
export = function(commands: Collection<string, MaylogCommand>, targetArray: SlashCommandBuilder[], includeManual?: boolean) {
    commands.forEach(data => {
        if (data.manualGuildRollout && !includeManual) return;
        let command: any = {
            name: data.name,
            description: data.description,
            dm_permission: !data.guildOnly,
            type: 1,
            options: []
        }
        if (data.guildOnly && data.userPermissions) command.defaultMemberPermissions = String(data.userPermissions);
        if (data.arguments) {
            const apply = (arg: MaylogArgument, option: any) => {
                option.name = (arg.name);
                option.description = (arg.description);
                const typeMap = [
                    [ MaylogEnum.Argument.Subcommand,      1 ],	
                    [ MaylogEnum.Argument.SubcommandGroup, 2 ],	
                    [ MaylogEnum.Argument.String,          3 ],	
                    [ MaylogEnum.Argument.Integer,         4 ],
                    [ MaylogEnum.Argument.Boolean,         5 ],	
                    [ MaylogEnum.Argument.User,            6 ],	
                    [ MaylogEnum.Argument.Channel,         7 ],
                    [ MaylogEnum.Argument.Role,            8 ],	
                    [ MaylogEnum.Argument.Mentionable,     9 ],
                    [ MaylogEnum.Argument.Number,          10 ],
                    [ MaylogEnum.Argument.Attachment,      11 ],
                ]
                typeMap.forEach(t => {
                    if (arg.type === t[0]) option.type = t[1];
                });
                if (!option.type) throw new Error(`${arg.name} has no type`)
                // option.type = arg.type;
                if (arg.type === MaylogEnum.Argument.Subcommand || arg.type === MaylogEnum.Argument.SubcommandGroup) option.options = [];
                if (arg.type !== MaylogEnum.Argument.SubcommandGroup && arg.type !== MaylogEnum.Argument.Subcommand) {
                    option.required = !arg.optional
                }

                if (arg.type === MaylogEnum.Argument.String) {
                    if (arg.choices) option.choices = arg.choices;
                    if (arg.minLength) option.min_length = (arg.minLength);
                    if (arg.maxLength) option.max_length = (arg.maxLength);
                }
                if (arg.type === MaylogEnum.Argument.String || arg.type === MaylogEnum.Argument.Integer || arg.type === MaylogEnum.Argument.Number) {
                    option.autocomplete = (!!arg.autocomplete!);
                }
                if (arg.type === MaylogEnum.Argument.Integer || arg.type === MaylogEnum.Argument.Number) {
                    if (arg.minValue) option.min_value = (arg.minValue);
                    if (arg.maxValue) option.max_value = (arg.maxValue);
                }
                if (arg.type === MaylogEnum.Argument.Channel) {
                    if (arg.channelTypes) option.channel_types = (arg.channelTypes);
                }
            }

            const parseArgument = (arg: MaylogArgument, parent: any) => {
                let argumentData = {}
                apply(arg, argumentData);
                if (arg.arguments && (arg.type === MaylogEnum.Argument.Subcommand || arg.type === MaylogEnum.Argument.SubcommandGroup)) {
                    for (const argument of arg.arguments) {
                        parseArgument(argument, argumentData);
                    }
                }
                if (parent.options) parent.options.push(argumentData);
            }

            for (const argument of data.arguments) {
                parseArgument(argument, command);
            }
        }
        targetArray.push(command as any);
    });
}