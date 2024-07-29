import fs from 'fs';

const packageJSON = JSON.parse(fs.readFileSync('package.json', 'utf8'));

interface IPackageJSON {
    name: string;
    version: string;
    description: string;
    author: string;
    license: string;
}

export default {
    version: packageJSON.version as string,
    packageJSON: packageJSON as IPackageJSON,
    dbName: {
        prod: 'maylog',
        dev: 'maylog-dev', // later change to maylog-dev
        mongoCertificationName: 'mongodb-maylog.crt'
    },
    RoVer_Bot_ID: '298796807323123712',
    intents: 43,//811,
    defaultPrefix: ';',
    developerIds: [ '212772501141323776' ],
    /** Currency symbol */
    cursym: '',
    defaultZone: 'America/Los_Angeles',
    /** Logging channels */
    expirationMs: {
        guild: 3600 * 1000, // One hour
        user: 2628000 * 1000, // 1 month
    },
    logs: {
        /** Guild ID */
        guild_id: '1096635116282978375',
        /** Log channel for guild joins and leaves. */
        guild_logs: '1110012970899079219',
        /** Log channel for bug reports */
        bug_reports: '1119710523232096306',
        /** Log channel for suggestions */
        suggestions: '1119710538977525791'
    },
    terms_and_privacy: 'https://hackmd.io/@DevAX1T/BJTrwV3u0',
    supportInvite: 'https://discord.gg/ZdHbP6ZwPK',
    docsLink: 'https://hackmd.io/@DevAX1T/HkFI5jDzh',
    inviteLink: `https://discord.com/oauth2/authorize?client_id=1096613340714893362&permissions=275884862544&scope=bot+applications.commands`,
    defaultGuildIcon: 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png'
}
/**33639
GUILDS (1 << 0)
GUILD_MEMBERS (1 << 1)
GUILD_EMOJIS_AND_STICKERS (1 << 3)
GUILD_WEBHOOKS (1 << 5)
GUILD_PRESENCES (1 << 8)
GUILD_MESSAGES (1 << 9)
 */