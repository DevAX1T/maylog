import GuildV2Object, { IMaylogGuild as GuildV2 } from '../../structures/core/Guild';

interface GuildV1 {
    blacklist: { status: false, reason: undefined | string },
    recentCommands: Date[],
    commandLogs: [],
    config: {
        dataPatches: string[],
        ranks: string[],
        commandRoles: string[],
        departmentCommandRoles: string[],
        departmentRole: '',
        administrativeLeaveRole: '',
        loaRole: '',
        suspendedRole: '',
        probationRole: '',
        autoRole: false,
        showAvatarOnActionMessages: false,
        activityLogChannel: false,
        actionRequestChannel: false,
        loaChannel: false,
        logChannel: false,
        departmentIconURL: '',
        adminLeaveContact: 'IA_HC',
        dischargeDisplay: 'terminate',
        adminLeaveDM: string;
        }
}

export = (data: GuildV1): GuildV2 => {
    const obj = structuredClone(GuildV2Object);
    //> Core
    obj.blacklist = data.blacklist.status === false ? false : data.blacklist.reason!
    obj.config.contact = data.config.adminLeaveContact;
    obj.config.departmentIcon = data.config.departmentIconURL;
    obj.config.embedOptions.dischargeDisplay = data.config.dischargeDisplay === 'terminate' ? false : true;
    obj.config.embedOptions.showAvatar = data.config.showAvatarOnActionMessages;
    obj.config.autoRole = data.config.autoRole;
    //> Channels
    obj.config.channels.action = typeof data.config.logChannel === 'string' ? data.config.logChannel : '';
    //> Roles
    obj.config.roles.command      = data.config.commandRoles;
    obj.config.roles.high_command = data.config.departmentCommandRoles;
    obj.config.roles.department   = data.config.departmentRole;
    obj.config.roles.admin_leave  = data.config.administrativeLeaveRole
    obj.config.roles.suspended    = data.config.suspendedRole
    obj.config.roles.loa          = data.config.loaRole
    obj.config.roles.probation    = data.config.probationRole

    return obj;
}