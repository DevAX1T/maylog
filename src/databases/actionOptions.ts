import { GuildMember, MessageEmbed } from 'discord.js';
import { DateTime } from 'luxon';
import { IMaylogGuild } from '../maylog/DataProvider';
import { MaylogCommandContext, MaylogArgument } from '../maylog/structures/MaylogCommand';
import { MaylogEnum } from '../maylog';
import { stripIndents } from 'common-tags';
import colors from './colors';
import Constants from '../Constants';
import contacts from './contacts';
import errors from '../databases/errors';
import examples from '../databases/examples';
import ms from '../util/ms';

const ARGUMENTS = {
    expiration: {
        name: 'expiration',
        description: 'When will this expire?',
        type: MaylogEnum.Argument.String,
        maxLength: 60
    } as MaylogArgument,
    rankPromote: {
        name: 'rank',
        description: 'What rank is the user being promoted to?',
        type: MaylogEnum.Argument.Role,
    } as MaylogArgument,
    rankDemote: {
        name: 'rank',
        description: 'What rank is the user being demoted to?',
        type: MaylogEnum.Argument.Role,
    } as MaylogArgument,
    divisionTransfer: {
        name: 'division',
        description: 'What division is the user transferring to?',
        type: MaylogEnum.Argument.Role
    } as MaylogArgument,
    divisionPromote: {
        name: 'division',
        description: 'What division is the user being promoted in?',
        type: MaylogEnum.Argument.Role
    } as MaylogArgument,
    divisionDemote: {
        name: 'division',
        description: 'What division is the user being demoted in?',
        type: MaylogEnum.Argument.Role
    } as MaylogArgument,
}
// ALSO MM.DD.YYYY AND MM/DD/YYYY (do regex)
const DMYY_REGEX = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/;
const MDY_REGEX = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;

function getExpirationMs(time: string): [ string | number, string ] | string {
    try {
        if (isIndef(time)) return [ -1, '**indefinitely**' ];
        let expirationMs: number | false = ms(time);
        if (expirationMs) expirationMs = Math.floor(expirationMs + Date.now());
    
        if (!expirationMs) {
            let match: RegExpMatchArray | null;
    
            expirationMs = DateTime.fromISO(time).setZone(Constants.defaultZone).toMillis();
            if (isNaN(expirationMs)) {
                // Try parsing with MDY_REGEX
                match = time.match(MDY_REGEX);
                if (match) {
                    const [_, month, day, year] = match;
                    expirationMs = DateTime.fromObject({ year: parseInt(year), month: parseInt(month), day: parseInt(day) }).setZone(Constants.defaultZone).toMillis();
                }
        
                // Try parsing with DMYY_REGEX if both MDY_REGEX and DMY_REGEX didn't match and expirationMs is still false
                if (!expirationMs) {
                    match = time.match(DMYY_REGEX);
                    if (match) {
                        const [_, day, month, year] = match;
                        expirationMs = DateTime.fromObject({ year: parseInt(year), month: parseInt(month), day: parseInt(day) }).setZone(Constants.defaultZone).toMillis();
                    }
                }
            }
    
            // Handle the case where Luxon's DateTime functions return NaN
            if (isNaN(expirationMs as number)) expirationMs = false;
        }
        if (!expirationMs || isNaN(expirationMs)) return [ -2, errors.InvalidDate ];
        return [ expirationMs, `until <t:${Math.floor(expirationMs / 1000)}:D>` ];
    } catch (error) {
        console.log(error);
        return [ -2, errors.InvalidDate ];
    }
}

function isIndef(str: string | undefined): boolean {
    if (!str) return false;
    return examples.time.indefinite.includes(str.toLowerCase());
}

interface IData {
    context: MaylogCommandContext;
    guild: IMaylogGuild;
    embed: MessageEmbed;
    subject: { username: string, user_id?: string, account?: string };
}

interface ActionData {
    [key: string]: {
        description: string;
        /** Don't include a subject argument */
        noSubject?: boolean;
        /** Don't include a notes argument */
        noNotes?: boolean;
        arguments?: MaylogArgument[];
        /** Add executor to the autoRole function*/
        requireExecutor?: string;
        /** Add user_id to the subject field */
        requireSubjectUserId?: string;
        exec: (data: IData) => void | string;
        autoRole?: (data: IData & { executor: { username: string; user_id: number, account: GuildMember } }) => Promise<void>
    }
}
// DevAX1T has **appealed** their activity warning.
// DevAX1T has **appealed** their recorded warning.
// DevAX1T has **appealed** their verbal warning.
// DevAX1T has **appealed** their suspension.
// todo: bulk actions (sends in multiple messages; ratelimit heavily)
// todo: change everything to webhooks (and auto make them too)
export default <ActionData>{
    award: {
        description: 'Log an award',
        arguments: [
            {
                name: 'award',
                description: 'What award do you want to issue?',
                type: MaylogEnum.Argument.String,
                autocomplete: true
            }
        ],
        exec: (data) => {
            const { embed, subject, guild } = data;
            const award = data.context.arguments.getString('award')!;
            if (award === '-') return 'You need to provide a valid award.';
            if (!guild.config.awards.includes(award)) return errors.NoAward;
            embed.setColor(colors.fromString('brightGold'));
            embed.setDescription(`**${subject.username}** has been issued the **${award}**.`);
        }
    },
    appeal: {
        description: 'Log an appeal.',
        arguments: [
            {
                name: 'type',
                description: 'What is the type of appeal?',
                type: MaylogEnum.Argument.String,
                choices: [
                    { value: 'activity_warning', name: 'Activity warning'    },
                    { value: 'recorded_warning', name: 'Recorded warning'    },
                    { value: 'verbal_warning',   name: 'Verbal warning'      },
                    { value: 'disciplinary',     name: 'Disciplinary Action' }
                ]
            }
        ],
        exec: (data) => {
            const { embed, subject } = data;
            const types = {
                activity_warning: 'activity warning',
                recorded_warning: 'recorded warning',
                verbal_warning: 'verbal warning',
                disciplinary: 'disciplinary action'
            }
            const type = types[data.context.arguments.getString('type') as keyof typeof types];
            embed.setColor(colors.fromString('blue'))
            embed.setDescription(`**${subject.username}** has **appealed** their **${type}**.`);
        }
    },
    accept: {
        description: 'Log department acceptance.',
        arguments: [ Object.assign({}, ARGUMENTS.rankPromote, { optional: true }) ],
        exec: (data) => {
            const { embed, subject } = data;
            const rank = data.context.arguments.getRole('rank');
            
            embed.setColor(colors.fromString('green'));
            embed.setDescription(`**${subject.username}** has been **accepted** into the **${data.context.guild!.name}**${
                rank ? ` and **promoted** to **${rank.name}**` : ''
            }.`);
        }
    },
    admin_leave: {
        description: 'Log a user\'s placement on administrative leave.',
        exec: (data) => {
            const { embed, subject, guild } = data;
            embed.setColor(colors.fromString('orange'));
            embed.setDescription(stripIndents`
                    **${subject.username}** has been placed on **administrative leave**.

                    Contact ${contacts[guild.config.contact]} if seen on-team.
            `);
        },
        autoRole: (data) => {
            return new Promise(async (resolve, reject) => {
                const role = data.guild.config.roles.admin_leave;
                if (!role) return reject('No auto-role for this action has been set.');
                data.context.guild!.members.fetch(data.subject.account!).then(user => {
                    user.roles.add(role).then(() => resolve()).catch(() => reject('Could not role user.'));
                }).catch(() => reject('Could not find guild member.'));
            });
        }
    },
    remove_admin: {
        description: 'Log a user\'s removal from administrative leave.',
        exec: (data) => {
            const { embed, subject } = data;
            embed.setColor(colors.fromString('blue'));
            embed.setDescription(`**${subject.username}** is no longer on **administrative leave**.`);
        }
    },
    probation: {
        description: 'Log a probationary period.',
        exec: (data) => {
            const { embed, subject, context } = data;
            const [ expirationMs, expStr ] = getExpirationMs(context.arguments.getString('expiration')!);
            if (expirationMs === -2) return expStr;

            embed.setColor(colors.fromString('probationGreen'));
            embed.setDescription(`**${subject.username}** is now on **probation** ${expStr}.`);
        }
    },
    remove_probation: {
        description: 'Log the end of a probationary period.',
        exec: (data) => {
            const { embed, subject } = data;
            embed.setColor(colors.fromString('blue'));
            embed.setDescription(`**${subject.username}** is no longer on **probation**.`);
        }
    },
    verbal_warning: {
        description: 'Log a verbal warning.',
        exec: (data) => {
            const { embed, subject } = data;
            embed.setColor(colors.fromString('orange'));
            embed.setDescription(`**${subject.username}** has received a **verbal warning**.`);
        }
    },
    recorded_warning: {
        description: 'Log a recorded warning.',
        exec: (data) => {
            const { embed, subject } = data;
            embed.setColor(colors.fromString('orange'));
            embed.setDescription(`**${subject.username}** has received a **recorded warning**.`);
        }
    },
    suspension: {
        description: 'Log a suspension.',
        arguments: [ ARGUMENTS.expiration ],
        exec: (data) => {
            const { embed, subject, guild, context } = data;
            const [ expirationMs, expStr ] = getExpirationMs(context.arguments.getString('expiration')!);
            if (expirationMs === -2) return expStr;
            embed.setColor(colors.fromString('orange'));
            embed.setDescription(stripIndents`
                **${subject.username}** has been **suspended** ${expStr}.

                Contact ${contacts[guild.config.contact]} if seen on team.
            `);
        }
    },
    unsuspend: {
        description: 'Log the end of a suspension.',
        exec: (data) => {
            const { embed, subject } = data;
            embed.setColor(colors.fromString('blue'));
            embed.setDescription(`**${subject.username}** has been **unsuspended**.`);
        }
    },
    transfer: {
        description: 'Log a division transfer.',
        arguments: [ ARGUMENTS.divisionTransfer ],
        exec: (data) => {
            const { embed, subject, context } = data;
            embed.setColor(colors.fromString('blue'));
            embed.setDescription(`**${subject.username}** has been **transferred** to **${context.arguments.getRole('division')!.name}**.`);
        }
    },
    transfer_promote: {
        description: 'Log a division transfer and promotion.',
        arguments: [ ARGUMENTS.rankPromote, ARGUMENTS.divisionTransfer ],
        exec: (data) => {
            const { embed, subject, context } = data;
            const divisionName = context.arguments.getRole('division')!.name;
            const rankName = context.arguments.getRole('rank')!.name
            embed.setColor(colors.fromString('green'));
            embed.setDescription(`**${subject.username}** has been **promoted** to **${rankName}** and **transfered** to **${divisionName}**.`);
        }
    },
    transfer_demote: {
        description: 'Log a division transfer and demotion.',
        arguments: [ ARGUMENTS.rankDemote, ARGUMENTS.divisionTransfer ],
        exec: (data) => {
            const { embed, subject, context } = data;
            const divisionName = context.arguments.getRole('division')!.name;
            const rankName = context.arguments.getRole('rank')!.name
            embed.setColor(colors.fromString('red'));
            embed.setDescription(`**${subject.username}** has been **demoted** to **${rankName}** and **transfered** to **${divisionName}**.`);
        }
    },
    promote: {
        description: 'Log a promotion.',
        arguments: [ ARGUMENTS.rankPromote, ARGUMENTS.divisionPromote ],
        exec: (data) => {
            const { embed, subject, context } = data;
            const division = context.arguments.getRole('division');
            const rankName = context.arguments.getRole('rank')!.name;
            let description = `**${subject.username}** has been **promoted** to **${rankName}**`
            if (division) description += ` within **${division.name}**`;
            embed.setColor(colors.fromString('green'));
            embed.setDescription(`${description}.`);
        }
    },
    demote: {
        description: 'Log a demotion.',
        arguments: [ ARGUMENTS.rankDemote, ARGUMENTS.divisionPromote ],
        exec: (data) => {
            const { embed, subject, context } = data;
            const division = context.arguments.getRole('division');
            const rankName = context.arguments.getRole('rank')!.name;
            let description = `**${subject.username}** has been **demoted** to **${rankName}**`
            if (division) description += ` within **${division.name}**`;
            embed.setColor(colors.fromString('red'));
            embed.setDescription(`${description}.`);
        }
    },
    loa: {
        description: 'Log a leave of absence.',
        arguments: [ ARGUMENTS.expiration ],
        exec: (data) => {
            const { embed, subject, context } = data;
            const [ expirationMs, expStr ] = getExpirationMs(context.arguments.getString('expiration')!);
            if (expirationMs === -2) return expStr;
            embed.setColor(colors.fromString('blue'));
            embed.setDescription(`**${subject.username}** is now on a **leave of absence** ${expStr}.`);
        }
    },
    remove_loa: {
        description: 'Log the end of a leave of absence.',
        exec: (data) => {
            const { embed, subject } = data;
            embed.setColor(colors.fromString('blue'));
            embed.setDescription(`${subject} is now longer on a **leave of absence**.`);
        }
    },
    custom: {
        description: 'Log a custom action.',
        noSubject: true,
        arguments: [
            {
                name: 'message',
                description: 'What is the message to log?',
                type: MaylogEnum.Argument.String,
                maxLength: 500
            },
            {
                name: 'preset_color',
                description: 'What color should be used? (Preset)',
                type: MaylogEnum.Argument.String,
                autocomplete: true,
                optional: true
            },
            {
                name: 'hex_color',
                description: 'What color should be used? (HEX)',
                type: MaylogEnum.Argument.String,
                maxLength: 10,
                optional: true
            },
        ],
        exec: (data) => {
            const { embed, context } = data;
            const message = context.arguments.getString('message')!;
            const presetColor = context.arguments.getString('preset_color');
            const hexColor = context.arguments.getString('hex_color');
            if (presetColor && hexColor) return 'You must pick either `hex_color` **OR** `preset_color`.';
            embed.setColor(colors.fromString((presetColor || hexColor) || 'mayLOG'));
            embed.setDescription(message);
        }
    },
    blacklist: {
        description: 'Log a blacklist for a user.',
        arguments: [ Object.assign({}, ARGUMENTS.expiration, { description: 'When will the blacklist expire? Use "inf" for never.' }) ],
        exec: (data) => {
            const { embed, subject, context } = data;
            const [ expirationMs, expStr ] = getExpirationMs(context.arguments.getString('expiration')!);
            if (expirationMs === -2) return expStr;

            embed.setColor(colors.fromString('black'));
            embed.setDescription(`**${subject.username}** has been **blacklisted** ${expStr}.`);
        }
    },
    discharge: {
        description: 'Log a discharge.',
        arguments: [
            {
                name: 'type',
                description: 'What is the discharge type?',
                type: MaylogEnum.Argument.String,
                choices: [
                    { name: 'Honorable', value: 'honorable' },
                    { name: 'Dishonorable', value: 'dishonorable' },
                    { name: 'General', value: 'general' },
                    { name: 'Preliminary', value: 'preliminary' }
                ]
            }
        ],
        exec: (data) => {
            const { embed, subject, context, guild } = data;
            let message = `**${subject.username}** `;
            colors.fromString('yellow')
            const options = {
                honorable:    [ 'yellow', 'has been **honorably** discharged',    'has **resigned** '        ],
                dishonorable: [ 'red',    'has been **dishonorably** discharged', 'has been **terminated** ' ],
                preliminary:  [ 'yellow', 'has been **preliminarily** discharged'                       ],
                general:      [ 'yellow', 'has been **generally** discharged'                           ]
            }
            const dischargeType = context.arguments.getString('type') as keyof typeof options;
            const isDischarge = guild.config.embedOptions.dischargeDisplay;
            const selection = options[dischargeType!][isDischarge ? 1 : 2];
            if (!selection) return errors.DischargeDisplay;
            message += selection;
            embed.setColor(colors.fromString(options[dischargeType][0]));
            embed.setDescription(`${message}${isDischarge ? '' : `from the **${context.guild!.name}**`}.`);
        }
    }
}