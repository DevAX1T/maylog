export enum CommandUsage {
    /** Chat only */
    Chat,
    /** Slash only */
    Slash,
    /** Both chat and slash */
    ChatSlash,
    /** Message context only */
    MessageContext,
    /** User context only */
    UserContext
}

export enum Argument {
    String,
    Integer,
    Number,
    Boolean,
    User,
    Channel,
    Role,
    /** A mentionable is a User or Role */
    Mentionable,
    Attachment,
    Subcommand,
    SubcommandGroup
}

export enum DiscordCaseAction {
    Warn,
    Kick,
    Ban,
    Softban,
    Unban,
    Mute,
    Unmute
}

export enum RobloxRecordAction {
    Warn,
    Kick,
    Ban,
    Unban,
    Mute,
    Unmute
}
export enum MaylogError {
    CommandNoResponse,
    GenericError,
    Cooldown
}
/** A result telling the system if a command was run successfully or not. */
export enum CommandResult {
    /** The command was run successfully */
    Success,
    /** The command was run successfully, however, it refused to perform a task. Do not force a cooldown on the user. */
    PartialSuccess,
    /** The command experienced a fatal error when processing data. */
    Error,
}
export enum CommandBlock {
    /** For a non-specific reason, a module Guard blocked the command from running */
    Guard,
    /** Non-discord permission error trying to run command */
    Permissions,
    /** Probably not used. User prevented from running command because of blacklist. */
    Blacklist,
    /** Cooldown prevented command from executing */
    Cooldown,
}
export enum PublishTarget {
    Global,
    Guild
}