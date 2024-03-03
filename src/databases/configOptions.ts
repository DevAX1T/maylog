import { ColorResolvable, GuildMember, MessageEmbed, InteractionReplyOptions, GuildTextBasedChannel } from 'discord.js';
import { DateTime } from 'luxon';
import { IMaylogGuild } from '../maylog/DataProvider';
import { Lock } from '../maylog/DataProvider/Redlock';
import { MaylogCommandContext, MaylogArgument } from '../maylog/structures/MaylogCommand';
import { ChannelType, MaylogEnum, UserPermissions } from '../maylog';
import { oneLine, stripIndents } from 'common-tags';
import * as Sentry from '@sentry/node';
import colors from './colors';
import Constants from '../Constants';
import contacts from './contacts';
import errors from './errors';
import Global from '../Global';
import ms from '../util/ms';
import validator from 'validator';
import emojis from './emojis';

interface IData {
    context: MaylogCommandContext;
    guild: IMaylogGuild;
    // embed: MessageEmbed;
    lock: Lock;
}

interface ConfigData {
    [key: string]: {
        description: string;
        /** Don't include a subject argument */
        arguments?: MaylogArgument[];
        exec: (data: IData) => Promise<InteractionReplyOptions>;
    }
}

const embeds = {
    success: (description: string, oldConfig?: string) => {
        const embed =  new MessageEmbed()
            .setDescription(`${emojis.authorized} ${description}`)
            .setColor(colors.fromString('green'));
        if (oldConfig) embed.addFields({ name: 'Old Configuration', value: oldConfig });
        return embed;
    },
    error: (description: string) => {
        return (new MessageEmbed()).setDescription(`${emojis.x} ${description}`).setColor(colors.fromString('red'));
    }
}
const REGEX = /<@&\d+>/g;
const REPLACE_REGEX = /<@&|>/g;

// todo: add a dank memer-like /alert system
// todo: when people use admin_leave, add a notice saying it no longer DMs people. Maybe implement in the future?
export default <ConfigData>{
    // Add command roles. Add high command roles. Add employee role
    // todo: add the AutoRole config option
    set_roles: {
        description: 'Set the employee role, command roles, or high command roles.',
        arguments: [
            {
                name: 'action',
                description: 'What do you want to do?',
                type: MaylogEnum.Argument.String,
                choices: [
                    { value: 'department',   name: 'Set the department role'           },
                    { value: 'high_command', name: 'Set high command roles'            },
                    { value: 'command',      name: 'Set command roles'                 },
                    { value: 'admin_leave',  name: 'Set the administrative leave role' },
                    { value: 'loa',          name: 'Set the LOA role'                  },
                    { value: 'suspended',    name: 'Set the suspended role'            },
                    { value: 'probation',    name: 'Set the probation role'            },

                ]
            },
            {
                name: 'modifier',
                description: 'Add/remove a single role or replace all roles.',
                type: MaylogEnum.Argument.String,
                choices: [
                    { value: 'add',     name: 'Add multiple roles'    },
                    { value: 'add',     name: 'Add a single role'     },
                    { value: 'remove',  name: 'Remove a single role'  },
                    { value: 'remove',  name: 'Remove multiple roles' },
                    { value: 'replace', name: 'Replace all roles'     },
                ]
                // choices: Global.makeChoices('add', 'remove', 'replace'),
            },
            {
                name: 'roles',
                description: 'What roles do you want to set? Mention the role(s).', // Todo: Detect if someone adds/removes 3+ roles at once. Tell them they can prefix it with +/- 
                type: MaylogEnum.Argument.String, // to add all/remove all
                optional: true
            },
        ],
        exec: async (data) => {
            const action = data.context.arguments.getString('action') as 'department' | 'command' | 'high_command'
                | 'admin_leave' | 'loa' | 'suspended' | 'probation';
            const modifier = data.context.arguments.getString('modifier') as 'add' | 'remove' | 'replace' | undefined;
            const rolesArg = data.context.arguments.getString('roles')!;
            if (modifier !== 'replace' && !rolesArg) return Promise.resolve(errors.ConfigNoRoleModifier);
            const limits: Record<typeof action, number> = {
                department:   1,
                command:      20,
                high_command: 10,
                admin_leave:  1,
                loa:          1,
                suspended:    1,
                probation:    1
            }
            const matchedRoles = rolesArg.match(REGEX);
            if (!matchedRoles && modifier !== 'replace') return Promise.resolve({ embeds: [ embeds.error(errors.ConfigNoRoleModifier) ] });
            // if (modifier === 'replace' && !matchedRoles) {
            //     data.guild.config.roles[action]
            //     return
            // }
            const rolesPrelim = matchedRoles!.map(id => id.replace(REPLACE_REGEX, ''));
            const roles = new Set<string>();
            rolesPrelim.forEach(r => {
                if (!data.context.guild!.roles.cache.has(r)) return;
                roles.add(r);
            });
            // const roles = rolesPrelim;
            if (modifier !== 'replace' && roles.size > limits[action]) return Promise.resolve({ embeds: [ embeds.error(`You can only provide a maximum of \`${limits[action]}\` roles for that type.`) ] });
            const oldValue = data.guild.config.roles[action];
            // todo: check to make sure roles exist and areint he server
            if (Array.isArray(oldValue)) {
                if (modifier === 'add') {
                    const oldSet = new Set<string>(oldValue);
                    roles.forEach(r => oldSet.add(r));
                    (data.guild.config.roles[action] as string[]) = [ ...oldSet ];
                } else if (modifier === 'remove') {
                    const roleSet = new Set<string>(oldValue as string[]);
                    roles.forEach(r => roleSet.delete(r));
                    (data.guild.config.roles[action] as string[]) = [ ...roleSet ];
                } else if (modifier === 'replace') {
                    (data.guild.config.roles[action] as string[]) = [ ...roles ];
                }
            } else {
                if (modifier === 'add') {
                    (data.guild.config.roles[action] as string) = [ ...roles ][0];
                } else if (modifier === 'remove') {
                    (data.guild.config.roles[action] as string) = ''
                } else if (modifier === 'replace') {
                    (data.guild.config.roles[action] as string) = [ ...roles ][0];
                }
            }
            
            let oldRoles: string;
            if (Array.isArray(oldValue)) {
                if (oldValue.length === 0) {
                    oldRoles = 'No roles set';
                } else {
                    oldRoles = oldValue.map(id => `<@&${id}>`).join(', ');
                    oldRoles += `\n\nIf you made a mistake, paste this in the \`roles\` argument to revert your change: \`${oldValue.map(id => `<@&${id}>`).join(' ')}\``;
                }
            } else oldRoles = oldValue ? `<@&${oldValue}>` : 'No role set';
            // if (limits[action] === 1) {
            //     (data.guild.config.roles[action] as string) = roles[0];
            // } else {
            //     (data.guild.config.roles[action] as string[]) = roles;
            // }
            try {
                await data.context.client.DataProvider.guilds.update(data.guild._id, data.guild);
                return Promise.resolve({ embeds: [ embeds.success('I successfully edited the roles.', oldRoles) ] });
            } catch (error) {
                Sentry.captureException(error);
                return Promise.reject(error);
            }
            return Promise.resolve(''); // Can embedit. Whyn ot do embeds?
        }
    },
    set_channel: {
        description: 'Set a channel to perform a specific function in',
        arguments: [
            {
                name: 'action',
                description: 'What type of action?',
                type: MaylogEnum.Argument.String,
                choices: [
                    { value: 'action',         name: 'Department Action Log'  },
                    // { value: 'action_request', name: 'Action Requests'        },
                    // { value: 'loa_request',    name: 'LOA Requests'           },
                    // { value: 'activity',       name: 'Activity Log'           },
                    // { value: 'activity_ance',  name: 'Activity Announcements' }
                ]
            },
            {
                name: 'channel',
                description: 'What channel do you want this action to log in?',
                type: MaylogEnum.Argument.Channel,
                channelTypes: ChannelType.GuildText
            }
        ],
        exec: async (data) => {
            const action = data.context.arguments.getString('action')!;
            const channel = data.context.arguments.getChannel('channel')! as GuildTextBasedChannel;
            // check if talk perms
            const hasPerms = channel.permissionsFor(data.context.guild!.members.me!)
                    .has(UserPermissions.SendMessages + UserPermissions.EmbedLinks + UserPermissions.ManageWebhooks);
            if (!hasPerms) {
                return Promise.resolve({ embeds: [ embeds.error(errors.NoPermissionsPreliminary) ] });
            }
            const oldChannel = data.guild.config.channels[action as keyof typeof data.guild.config.channels];
            data.guild.config.channels[action as keyof typeof data.guild.config.channels] = channel.id;
            try {
                await data.context.client.DataProvider.guilds.update(data.guild._id, data.guild);
                return Promise.resolve({ embeds: [ embeds.success('I successfully edited the channel', `<@&${oldChannel}>`) ] });
            } catch (error) {
                Sentry.captureException(error);
                return Promise.reject(error);
            }
        }
    },
    department_icon: {
        description: 'Modify the department icon to show on various embeds.',
        arguments: [
            {
                name: 'url',
                description: 'Icon URL. Leave blank to use guild icon.',
                type: MaylogEnum.Argument.String,
                maxLength: 500,
                optional: true
            }
        ],
        exec: async (data) => {
            const url = data.context.arguments.getString('url')!;
            try {
                const previousURL = data.guild.config.departmentIcon;
                if (url) {
                    if (!validator.isURL(url)) return Promise.resolve(errors.InvalidURL);
                    data.guild.config.departmentIcon = url;
                } else {
                    data.guild.config.departmentIcon = '';
                }
                await data.context.client.DataProvider.guilds.update(data.guild._id, data.guild);
                const embed = embeds.success(`I successfully ${url ? 'set' : 'reset'} the department icon.`,
                    previousURL ? `\`${previousURL}\`` : undefined);
                return Promise.resolve({ embeds: [ embed ] });
            } catch (error) {
                return Promise.reject(error);
            }
        },
    },
    discharge_display: {
        description: 'Modify if discharge shows up as "terminate" or "discharged."',
        arguments: [
            {
                name: 'display',
                description: 'How will discharges look?',
                type: MaylogEnum.Argument.String,
                choices: [
                    { name: '{user} has been terminated from the {department_name}', value: 'terminate' },
                    { name: '{user} has been discharged from the {department_name}', value: 'discharge' },
                ],
                optional: false
            }
        ],
        exec: async (data) => {
            const display = data.context.arguments.getString('display')!;
            data.guild.config.embedOptions.dischargeDisplay = display === 'discharge' ? true : false
            try {
                await data.context.client.DataProvider.guilds.update(data.guild._id, data.guild);
                return Promise.resolve( { embeds: [ embeds.success('I successfully edited the discharge display!') ] });
            } catch (error) {
                Sentry.captureException(error);
                return Promise.reject(error);
            }
        }
    }
}