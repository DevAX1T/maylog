import { Collection, Guild } from 'discord.js';
import { join } from 'path';
import { ModuleIndex } from '.';
import { MaylogClient, MaylogModuleId, MaylogEnum } from '../maylog';
import fs from 'fs';
import Global, { ILog } from '../Global';
import Logger from '../util/Logger';
import MaylogCommand, { MaylogCommandContext } from '../maylog/structures/MaylogCommand';
import MaylogEvent from '../maylog/structures/MaylogEvent';

export default class Module {
    public readonly id: MaylogModuleId;
    public readonly client: MaylogClient;
    public readonly commands = new Collection<string, MaylogCommand>();
    /** If true, the module CANNOT be disabled by guilds. */
    public readonly noDisable: boolean = false;
    /** Returns module directory */
    get directory() {
        return join(this.client.dirname, 'modules', this.id);
    }
    /** Returns module directory appended by the commands folder */
    get commandsDirectory() {
        return join(this.directory, 'commands');
    }
    /** Returns module directory appended by the events folder */
    get eventsDirectory() {
        return join(this.directory, 'events');
    }
    /** Returns the user facing name of the module instead of its ID */
    get name() {
        return ModuleIndex[this.id].name;
    }
    constructor(moduleId: MaylogModuleId, client: MaylogClient) {
        this.id = moduleId;
        this.client = client;
    }
    dataTable() {
        return { id: this.id, isEnabled: true };
    }
    /**
     * Alias for running <this>.loadEvents() and <this>.loadCommands()
     */
    register() {
        this.registerEvents();
        this.registerCommands();
        Logger.log(ILog.Level.Debug, 'Maylog', `Initialized module '${this.id}'`)
    }
    /**
     * Unregister everything and stop..listening.
     * @important Events are not (really) affected.
     */
    deregister() {
        throw new Error(`Dergister not implemented for module '${this.id}'`);
        // this.client.CommandManager.unregisterByModule(this.id);
        // this.client.EventManager.
        // event emitter .removeListener(handleFunction)
    }
    /** Iterates through the respective events directory for the module and registers each event */
    registerEvents() {
        if (!fs.existsSync(this.eventsDirectory)) return;
        Global.searchDir(this.eventsDirectory, (_: string, EventFile: any) => {
            const EventClass = EventFile.default ?? EventFile;
            if (!EventClass || !Global.isClass(EventClass)) return;
            const event: MaylogEvent<any> = new EventClass(this.client);
            this.client.Registry.registerEvent(event);
            // this.client.EventManager.registerEvent(this.id, event);
        });
    }
    /** Iterates through the respective commands directory for the module and registers each command. */
    registerCommands() {
        if (!fs.existsSync(this.commandsDirectory)) return;
        Global.searchDir(this.commandsDirectory, (_: string, CommandFile: any) => {
            if (!CommandFile || !Global.isClass(CommandFile)) return;
            const command: MaylogCommand = new CommandFile(this.client);
            // if (this.client.disabledCommands.includes(command.name)) return;
            // this.client.CommandManager.registerCommand(command);
            this.client.Registry.registerCommand(command).catch(error => {
                Logger.log(ILog.Level.Error, 'Registry', error);
            });
        });
    }
    /**
     * Runs once on startup and whenever called.
     * Returns if the module is enabled.
     * @returns Promise
     */
    async guard_onInitialization(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            resolve(true);
            // implement disabled modules
        });
    }
    /**
     * Runs every command execution. Must Promise<true/false>
     * If returns true, allows command execution to proceed, otherwise throws the interaction.
     * @important This command simply blocks execution -- a response function should be implemented in this command if suitable.
     * @param  {MaylogCommandContext} context
     * @returns Promise
     */
    async guard_preExecution(context: MaylogCommandContext): Promise<[result: boolean, message?: string]> {
        return Promise.resolve([true]); // Return true for no protection
    }
    async guard_postExecution(context: MaylogCommandContext, result: MaylogEnum.CommandResult): Promise<void> {
        return Promise.resolve();
    }
}