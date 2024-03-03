import { Awaitable, Client, ClientEvents, ClientOptions, Collection, Guild } from 'discord.js';
import { CoreDataProvider, IProviderOptions } from '../DataProvider';
import { MaylogEnum } from '..';
import MaylogCommand from './MaylogCommand';
import MaylogEvent from './MaylogEvent';
import Module from '../../modules/Module';
import path from 'path';
import Registry from './Registry';
import Statistics from './Statistics';

export namespace NSClient {
    export type KeyofEvents = keyof MaylogClientEvents;
    export interface MaylogClientEvents extends ClientEvents {
        eventRegistered: [MaylogEvent<any>];
        eventDeregistered: [MaylogEvent<any>];
        /** Emits when all modules are registered. */
        modulesRegistered: [void];
        commandBlock: [command: MaylogCommand, blockType: MaylogEnum.CommandBlock];
        /** Emits when a module is enabled. If {@link Guild} is not enabled, Maylog developers were responsible.*/
        moduleEnabled: [module: Module, guild?: Guild];
        /** Emits when a module is disabled. If {@link Guild} is not enabled, Maylog developers were responsible.*/
        moduleDisabled: [module: Module, guild?: Guild];
        moduleRegister: [module: Module];
        moduleDeregister: [module: Module, isReloading: boolean];
        moduleReload: [module: Module];
        /** Emits when a command is enabled. If {@link Guild} is not enabled, Maylog developers were responsible.*/
        commandEnabled: [module: Module, guild?: Guild];
        /** Emits when a command is disabled. If {@link Guild} is not enabled, Maylog developers were responsible.*/
        commandDisabled: [module: Module, guild?: Guild];
        commandRegister:   [command: MaylogCommand];
        commandDeregister: [command: MaylogCommand, isReloading: boolean];
        commandReload: [command: MaylogCommand];
    }
}
export interface MaylogClientOptions extends ClientOptions {
    defaultPrefix: string;
    dirname: string;
    providers: IProviderOptions;
}

export interface IMaylogThrottle {

}

// Have buttons modals and whatever under Dispatcher too

// ALSO: autocomplete must be in slash command, otherwise, it finds the closest result and uses that (if text)
// you can disable that with autocompleteDefault argument 

/**
 * Cooldowns are stored in redis
 */
export default class MaylogClient extends Client {
    public readonly defaultPrefix: string;
    public readonly modulesDirectory: string;
    public readonly dirname: string;
    public readonly modules = new Collection<string, Module>();
    public readonly throttles = new Map<string, IMaylogThrottle>();
    public readonly Registry: Registry;
    public readonly DataProvider: CoreDataProvider;
    public readonly Statistics: Statistics;
    constructor(options: MaylogClientOptions) {
        super(options);
        this.defaultPrefix = options.defaultPrefix;
        this.dirname = options.dirname;
        this.modulesDirectory = path.join(this.dirname, 'modules');
        this.DataProvider = new CoreDataProvider(this, options.providers);
        this.Registry = new Registry(this);
        this.Statistics = new Statistics(this, this.DataProvider);
    }
    public async login(token?: string | undefined): Promise<string> {
        // Connect to the database first
        try {
            await this.DataProvider.dbConnect();
        } catch {
            return Promise.reject('Failed to connect to databases');
        }
        return super.login(token);
    }
    /** Get a "mentionable" command string*/
    getCommandString(commandName: string, noFallback?: boolean): `</${string}:${string}>` | `the \`/${string}\` command` | false {
        const foundCommand = this.application!.commands.cache.find(c => c.name === commandName);
        if (!foundCommand) {
            return noFallback ? false : `the \`/${commandName}\` command`;
        }
        return `</${commandName}:${foundCommand.id}>`;
    }
    /**
     * Returns a specific command by name
     * @param  {string} commandName
     * @returns MaylogCommand
     */
    findCommand(commandName: string): MaylogCommand | undefined {
        return this.getAllCommands().filter(command => command.name === commandName)[0];
    }
    /**
     * Returns an array of all commands
     * @returns MaylogCommand
     */
    getAllCommands(): MaylogCommand[] {
        const commands: MaylogCommand[] = [];
        this.modules.forEach(module => module.commands.forEach(command => commands.push(command)));
        return commands;
    }
    loadProviders() {
        // create <client>.mongo; <client>.redis;
    }
    //> Base client event functions
    public on<S extends string | symbol>(event: Exclude<S, keyof NSClient.MaylogClientEvents>, listener: (...args: any[]) => Awaitable<void>): this;
    public on<K extends keyof NSClient.MaylogClientEvents>(event: K, listener: (...args: NSClient.MaylogClientEvents[K]) => Awaitable<void>): this;
    public on<K extends keyof NSClient.MaylogClientEvents>(event: K, listener: (...args: NSClient.MaylogClientEvents[K]) => Awaitable<void>): this {
        return super.on(event as any, listener as any);
    }
    public once<K extends keyof NSClient.MaylogClientEvents>(event: K, listener: (...args: NSClient.MaylogClientEvents[K]) => Awaitable<void>): this;
    public once<S extends string | symbol>(event: Exclude<S, keyof NSClient.MaylogClientEvents>, listener: (...args: any[]) => Awaitable<void>): this {
        return super.once(event as any, listener);
    }
    public emit<K extends keyof NSClient.MaylogClientEvents>(event: K, ...args: NSClient.MaylogClientEvents[K]): boolean;
    public emit<S extends string | symbol>(event: Exclude<S, keyof NSClient.MaylogClientEvents>, ...args: unknown[]): boolean {
        return super.emit(event as any, ...args);
    }
    
    public off<K extends keyof NSClient.MaylogClientEvents>(event: K, listener: (...args: NSClient.MaylogClientEvents[K]) => Awaitable<void>): this;
    public off<S extends string | symbol>(event: Exclude<S, keyof NSClient.MaylogClientEvents>, listener: (...args: any[]) => Awaitable<void>): this {
        return this.off(event as any, listener);
    }
    
    public removeAllListeners<K extends keyof NSClient.MaylogClientEvents>(event?: K): this;
    public removeAllListeners<S extends string | symbol>(event?: Exclude<S, keyof NSClient.MaylogClientEvents>) {
        return this.removeAllListeners(event as any);
    }
}