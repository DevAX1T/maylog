import contacts from '../../../../databases/contacts';

export interface IMaylogGuild {
    _id: string;
    /** Data STRUCTURE version () */
    version: 2,
    blacklist: false | string;
    patches: string[];
    config: {
        disabledModules: string[],
        disabledCommands: string[],
        /** Department/group ranks */
        ranks: string[];
        /** Roblox ID. Will bind ranks and stuff automatically */
        groupId: number;
        /** Fetch the executor manually instead of relying on display name? */
        fetchExecutor: boolean;
        autoRole: boolean;
        contact: keyof typeof contacts;
        /** Department icon URL */
        departmentIcon: string;
        // activityOptions: {
        //     isEnabled: boolean;
        //     apiKey: string;
        //     quota: any[]; 
        //     team: string;
        //     cycle: {
        //         isSkipped: boolean;
        //         duration: number;
        //         cycleEndMs: number;
        //     }
        // },
        embedOptions: {
            title: string; // Only modified for trusted servers. Probably a preconfig choices set.
            /** false for terminated. true for discharged. */
            dischargeDisplay: boolean;
            /** Show avatar on action messages */
            showAvatar: boolean;
        },
        roles: {
            command: string[];
            high_command: string[];
            department: string;
            admin_leave: string;
            suspended: string;
            probation: string;
            loa: string;
        };
        channels: {
            loa: string;
            /** Where all department action logs are sent */
            action: string;
            actionRequest: string;
            /** Where all activity log submissions are sent */
            activityLog: string;
            /** Activity log channel */
            activity_ance: string;
        };
        DMs: {
            admin_leave: string;
        };
        /** Typically webhooks */
        secrets: Record<string, string>;
    }
}

export default <IMaylogGuild>{
    _id: '',
    version: 2,
    blacklist: false,
    patches: [],
    config: {
        disabledModules: [],
        disabledCommands: [],
        /** Department/group ranks */
        ranks: [],
        /** Roblox ID. Will bind ranks and stuff automatically */
        groupId: 0,
        fetchExecutor: false,
        autoRole: false,
        contact: 'IA_HC',
        /** Department icon URL */
        departmentIcon: '',
        // activityOptions: {
        //     isEnabled: false,
        //     apiKey: '',
        //     quota: [],
        //     team: '',
        //     cycle: {
        //         isSkipped: false,
        //         duration: 0,
        //         cycleEndMs: 0,
        //     }
        // },
        embedOptions: {
            title: 'Department Action', // Only modified for trusted servers. Probably a preconfig choices set. [Department Action | Department Log | User Action | User Log]
            /** false for terminated. true for discharged. */
            dischargeDisplay: true,
            /** Show avatar on action messages */
            showAvatar: false,
        },
        roles: {
            command: [],
            high_command: [],
            department: '',
            admin_leave: '',
            suspended: '',
            probation: '',
            loa: ''
        },
        channels: {
            loa: '',
            /** Where all department action logs are sent */
            action: '',
            actionRequest: '',
            /** Where all activity log submissions are sent */
            activityLog: '',
            activity_ance: ''
        },
        DMs: {
            admin_leave: ''
        },
        secrets: {}
    }
}