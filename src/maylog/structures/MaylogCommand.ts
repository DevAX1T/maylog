import { ApplicationCommandOptionAllowedChannelTypes } from '@discordjs/builders';
import { ILog } from '../../Global';
import { IMaylogGuild } from '../DataProvider';
import { MaylogModuleId, MaylogClient, MaylogEnum } from '..';
import Logger from '../../util/Logger';
import Module from '../../modules/Module';
import {
    GuildMember, CacheType, User, CommandInteraction, InteractionDeferReplyOptions,
    MessageResolvable, MessagePayload, InteractionReplyOptions, InteractionEditReplyOptions,
    GuildCacheMessage, CommandInteractionOptionResolver, Guild
} from 'discord.js';
interface IChoice {
    name: string;
    value: string;
}

export interface MaylogArgument {
    name: string;
    description: string;
    type: MaylogEnum.Argument;
    optional?: boolean; // Required by default
    arguments?: MaylogArgument[];
    /** 
     * @important String only
     */
    choices?: IChoice[];
    channelTypes?: ApplicationCommandOptionAllowedChannelTypes;
    autocomplete?: boolean;
    /**
     * If enabled, allows autocomplete (for text commands) to 
     * @important `autocomplete` must be enabled.
     */
    autocompleteDefault?: boolean;
    /** @important Only valid for a number/integer */
    minValue?: number;
    /** @important Only valid for a number/integer */
    maxValue?: number;
    /** @important Only valid for a string */
    minLength?: number;
    /** @important Only valid for a string */
    maxLength?: number;
}

export interface MaylogCommandOptions {
    /** Command name */
    name: string;
    /** Command description */
    description: string;
    requiresCommandRoles?: boolean;
    requiresHighCommandRoles?: boolean;
    requiresGroupIntegration?: boolean;
    requiresLogChannel?: (keyof IMaylogGuild['config']['channels'])[];
    /** Command aliases (for text command) */
    aliases?: string[];
    /** Example usage for the command. Automatically appends prefix */
    example?: string | string[];
    /** Is the command guild only? */
    guildOnly?: boolean;
    /** Hide the command from help/diagnosis/etc */
    hide?: boolean;
    /** Is the command NSFW? */
    nsfw?: boolean;
    /** Don't roll out to all guilds; only roll out to selected guilds */
    manualGuildRollout?: string[];
    /** Required user flags to execute the command
     * @evaluator BaseModule
    */
    module: MaylogModuleId; // a module to associate the command with
    arguments?: MaylogArgument[];
    /** Permissions the bot requires to run the command */
    clientPermissions?: bigint;
    /** Permissions the bot requires in the channel to run the command */
    channelPermissions?: bigint;
    /** Permissions the user requires to run the command (if the module doesnt allow it already) */
    userPermissions?: bigint;
    /**
     * The amount of milliseconds that must pass before the command handler stops waiting for a response (e.g. logging)
     * Commands should return a CommandExecutionResult Enum at the end of execution
     */
    timeoutMs?: number;
    /** Command cooldown in milliseconds */
    cooldown?: number;
}

export interface MaylogCommandContext<Cached extends CacheType = CacheType> {
    command: MaylogCommand;
    interaction: CommandInteraction;
    author: GuildMember | User;
    guild?: Guild;
    client: MaylogClient;
    arguments: CommandInteractionOptionResolver;
    deferReply(options: InteractionDeferReplyOptions & { fetchReply: true }): Promise<GuildCacheMessage<Cached>>;
    deferReply(options?: InteractionDeferReplyOptions): Promise<void>;
    deleteReply(message?: MessageResolvable | '@original'): Promise<void>;
    editReply(options: string | MessagePayload | InteractionEditReplyOptions): Promise<GuildCacheMessage<Cached>>;
    safeReply(options: string | MessagePayload | InteractionEditReplyOptions): Promise<GuildCacheMessage<Cached>>;
    fetchReply(message?: MessageResolvable | '@original'): Promise<GuildCacheMessage<Cached>>;
    followUp(options: string | MessagePayload | InteractionReplyOptions): Promise<GuildCacheMessage<Cached>>;
    reply(options: InteractionReplyOptions & { fetchReply: true }): Promise<GuildCacheMessage<Cached>>;
    reply(options: string | MessagePayload | InteractionReplyOptions): Promise<void>;
}

export default class MaylogCommand implements MaylogCommandOptions {
    public readonly name: string = '$silent';
    public readonly description: string = '$silent';
    public readonly cooldown?: number | undefined;
    public readonly clientPermissions?: bigint | undefined;
    public readonly userPermissions?: bigint | undefined;
    public readonly channelPermissions?: bigint | undefined;
    public readonly aliases?: string[] | undefined;
    public manualGuildRollout?: string[] | undefined; // not readonly because of Core (dev commands)
    public guildOnly?: boolean | undefined; // same thing as above
    public readonly module: MaylogModuleId;
    public readonly nsfw: boolean | undefined;
    public readonly hide: boolean | undefined;
    public readonly arguments?: MaylogArgument[] | undefined;
    public readonly requiresCommandRoles?: boolean;
    public readonly requiresHighCommandRoles?: boolean;
    public readonly requiresGroupIntegration?: boolean;
    public readonly requiresLogChannel?: (keyof IMaylogGuild['config']['channels'])[] | undefined;
    public readonly client: MaylogClient;
    constructor(client: MaylogClient, options: MaylogCommandOptions) {
        this.client = client;
        this.name = options.name;
        this.description = options.description;
        this.module = options.module; // Module always exists
        // if (options.name) this.name = options.name;
        // if (options.description) this.description = options.description;
        if (options.cooldown) this.cooldown = options.cooldown;
        if (options.clientPermissions) this.clientPermissions = options.clientPermissions;
        if (options.userPermissions) this.userPermissions = options.userPermissions;
        if (options.channelPermissions) this.channelPermissions = options.channelPermissions;
        if (options.aliases) this.aliases = options.aliases;
        if (options.manualGuildRollout) this.manualGuildRollout = options.manualGuildRollout;
        // if (options.module) this.module = options.module;
        if (options.nsfw) this.nsfw = options.nsfw;
        if (options.hide) this.hide = options.hide;
        if (options.arguments) this.arguments = options.arguments;
        if (options.guildOnly) this.guildOnly = options.guildOnly;
        if (options.requiresCommandRoles) this.requiresCommandRoles = options.requiresCommandRoles;
        if (options.requiresHighCommandRoles) this.requiresHighCommandRoles = options.requiresHighCommandRoles;
        if (options.requiresGroupIntegration) this.requiresGroupIntegration = options.requiresGroupIntegration;
        if (options.requiresLogChannel) this.requiresLogChannel = options.requiresLogChannel;
    }
    /**
     * Evalutes if someone has the correct permissions to run a command (instead of module-based)
     * @important Resolve with false if failure; only reject on error.
     * @param  {MaylogCommandContext} context
     * @returns Promise - if resolved with string, ephemeral reply rejecting permissions. If resolved without, then let the command run.
     */
    async preExecution(context: MaylogCommandContext): Promise<[ status: boolean, message?: string]> {
        return Promise.resolve([ true ]);
    }
    /**
     * General run function. Works with both text commands and slash commands.
     * @param  {MaylogCommandContext} context
     * @returns Promise
     */
    async run(context: MaylogCommandContext): Promise<MaylogEnum.CommandResult> {
        throw new Error(`${this.module}:${this.name} has no 'run' function.`);
    }
    /**
     * SlashOnly run function.
     * @param  {MaylogCommandContext} context
     * @returns Promise
     */
    async run_slash(context: MaylogCommandContext): Promise<MaylogEnum.CommandResult> {
        throw new Error(`${this.module}:${this.name} has no 'run' function.`);
    }
    async run_text(context: MaylogCommandContext): Promise<MaylogEnum.CommandResult> {
        throw new Error(`${this.module}:${this.name} has no 'run' function.`);
    }
    /** Alias for <Logger>.log() */
    log(level: ILog.Level, title: string, context: string) {
        return Logger.log(level, title, context);
    }
    /** Returns the module object for the command. Basically a shortcut. */
    getModule(): Module | undefined {
        for (const module of this.client.Registry.modules.values()) {
            if (module.id === this.module) return module;
        }
    }
}