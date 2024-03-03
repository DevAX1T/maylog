import { stripIndents } from 'common-tags';
import Constants from '../Constants';
import examples from './examples';

const map = (array: any[]) => {
    return array.map(x => `\`${x}\``).join(', ');
}

export default {
    ConfigNoRoleModifier: stripIndents`
        You left the \`roles\` argument blank! You can only do that if you're using the \`replace\` modifier.
        In order to add or remove roles, you must ping them in the argument. You can ping multiple roles unless the specific action type only allows one.
        If you need more help, you can always [read the documentation](${Constants.docsLink})!;
    `,
    InvalidURL: stripIndents`
        You didn't provide a valid URL or link. Please ensure that what you sent me actually redirects to a **picture**.
        If you need more help, you can always [read the documentation](${Constants.docsLink})!;
    `,
    ConfigAcquireLock: stripIndents`
        An error occurred trying to configure the server. This may be a result of another operation already being in-progress.
        This error should resolve itself in around a minute - if not, then the database I use may be down.
    `,
    InvalidDate: stripIndents`
        You didn't put a valid time in. Here's a few examples of a valid time:
        - **ISO8601**: ${map(examples.time.ISO)}. [Generate an ISO string here!](https://timestampgenerator.com/)
        - **YYYY-MM-DD**: ${map(examples.time.YYYYMMDD)}.
        - **MM/DD/YYYY** ${map(examples.time.MMDDYYYY)}.
        - **DD.MM.YYYY** ${map(examples.time.DDMMYYYY)}.
        - **duration**: ${map(examples.time.duration)}. (mo = month, d = day, h = hour, m = minutes, s = second)
        - **indefinite**: ${map(examples.time.indefinite)}. This will simply put "Indefinite" on any embed.
        *YYYY-MM-DD and ISO8601 strings automatically have their zone set to America/Los_Angeles.*
    `,
    DischargeDisplay: stripIndents`
        This server's configuration has \`DischargeDisplay\` disabled. What does this mean?
        DischargeDisplay is a way to modify the look of discharges. This applies to all types of discharges. An example can be seen below:
        If \`DischargeDisplay\` is disabled, all "dishonorable" discharges show up as "*Username* has been **terminated** from the *ServerName*".
        If \`DischargeDisplay\` is enabled, all "dishonorable" discharges show up as "*Username* has been **honorably** discharged."
        
        DischargeDisplay must be enabled to use the \`general\` and \`preliminary\` discharge options.
    `,
    SubjectSearch: stripIndents`
        I couldn't find the subject of that action. This could be a result of Roblox or RoVer being down. If it isn't here's what I support:
        - \`Mentions\`: You can mention someone (e.g. \`<@${Constants.RoVer_Bot_ID}>\`/\`@Username\`/<@${Constants.RoVer_Bot_ID}>) **who is in your server** in the subject argument.
        - \`Usernames\`: You can use a normal Roblox username (e.g. \`DevAX1T\`) in the subject argument.
        - \`UserIDs\`: You can use a Roblox Userid (e.g. \`#125196014\`) in the subject argument.

        If you need more help, you can always [read the documentation](${Constants.docsLink})!
    `,
    NoLogChannel: stripIndents`
        I couldn't find a channel to send this action in. By default, I see if any channel is named \`#department-logs\`, otherwise I use the configured log channel.
        If you need more help, you can always [read the documentation](${Constants.docsLink})!;
    `,
    NoPermissionsPreliminary: stripIndents`
        I lack some permissions to use that channel. Please ensure I have the following permissions: \`EMBED_LINKS\`, \`SEND_MESSAGES\`, and \`MANAGE_WEBHOOKS\`.
    `,
    NoPermissions: stripIndents`
        I couldn't post a message in the log channel because I lack permissions. Please ensure that I always have the \`EMBED_LINKS\`, \`SEND_MESSAGES\`, and \`MANAGE_WEBHOOKS\` permissions.
        By default, I search for any channel named \`#department-logs\` if none is configured.
        If you need more help, you can always [read the documentation](${Constants.docsLink})!
    `,
    PendingActions: stripIndents`
        You can only have five pending actions at one time. This means that you have to either post an action or wait a minute for it to expire.
        If you need more help, you can always [read the documentation](${Constants.docsLink})!
    `
}