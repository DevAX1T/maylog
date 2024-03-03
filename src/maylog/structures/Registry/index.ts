import { Collection } from 'discord.js';
import { join } from 'path';
import { REST } from '@discordjs/rest';
import { RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from 'discord-api-types/v9';
import { SlashCommandBuilder } from '@discordjs/builders';
import { MaylogEnum } from '../../../maylog';
import { MaylogModuleId, ModuleIndex } from '../../../modules';
import * as Sentry from '@sentry/node';
import Dispatcher from './Dispatcher';
import fs from 'fs';
import Global, { ILog } from './../../../Global';
import Logger from '../../../util/Logger';
import Module from '../../../modules/Module';
import path from 'path';
import SlashAPI from './SlashAPI';
import MaylogClient from '../MaylogClient';
import MaylogCommand from '../MaylogCommand';
import MaylogEvent from '../MaylogEvent';



/** Complete registry of commands and events */
export default class Registry {
    /** Indexed by name */
    public readonly commands = new Collection<string, MaylogCommand>();
    /** Indexed by name*/
    public readonly events = new Collection<string, MaylogEvent<any>>();
    /** Indexed by ID */
    public readonly modules = new Collection<string, Module>();
    public readonly Dispatcher: Dispatcher;
    /** Disabled modules are hardcoded and cannot be registered (sorted by id) */
    public readonly disabledModules = new Set<MaylogModuleId>();
    /** Disabled commands are hardcoded and cannot be registered (sorted by name) */
    public readonly disabledCommands = new Set<string>();
    /** Disabled events (by event name (ex. 'AutomodMessageHook'), not event code (ex. 'messageCreate')) */
    public readonly disabledEvents = new Set<string>();
    public readonly client: MaylogClient;
    constructor(client: MaylogClient) {
        this.client = client;
        this.Dispatcher = new Dispatcher(client, this);
        this.client.on('modulesRegistered', () => {
            Logger.log(ILog.Level.Info, 'Registry', `Registered ${this.modules.size} modules.`);
            Logger.log(ILog.Level.Info, 'Registry', `Registered ${this.commands.size} commands.`);
        });
    }
    /** Search a module directory */
    private scanModuleDirectory(directory: string, execFunction: Function) {
        fs.readdirSync(directory).forEach(file => {
            const joined = path.join(directory, file);
            const stat = fs.statSync(joined);
            if (stat.isDirectory()) { // it literally should be a directory
                // iterate thru and read index
                const newPath = path.join(joined, 'index.js');
                const _file = require(newPath);
                execFunction(newPath, _file);
            }
        });
    }
    registerModule(moduleName: string): Promise<void> {
        let path: string;
        if (Object.keys(ModuleIndex).includes(moduleName)) {
            path = join(this.client.dirname, 'modules', moduleName);
        } else { // Genuine path. Register the module as a single thign
            path = moduleName;
        }
        const rawFile = require(path);
        const ModuleClass = rawFile.default ?? rawFile;
        if (!Global.isClass(ModuleClass)) return Promise.reject(`Path not a valid module: ${path}`);
        const module: Module = new ModuleClass(this.client);
        if (this.modules.has(module.id)) return Promise.reject(`Module '${module.id}' is already registered.`);
        if (this.disabledModules.has(module.id)) return Promise.reject(`Module '${module.id}' is hard-coded disabled.`);
        this.modules.set(module.id, module);
        Logger.log(ILog.Level.Debug, 'Registry', `Registered module '${module.id}'`);
        module.register();

        this.client.emit('moduleRegister', module);
        return Promise.resolve();
    }
    registerModules(path: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.scanModuleDirectory(path, (currentPath: string, ModuleFile: any) => {
                    // Logger.log(ILog.Level.DebugExtended, 'Registry', `Module path registering: ${currentPath}`);
                    const ModuleClass = ModuleFile.default ?? ModuleFile;
                    if (!Global.isClass(ModuleClass)) return;
                    const module: Module = new ModuleClass(this.client);
                    if (!ModuleIndex[module.id].enabled) return; // Don't enable disabled modules
                    if (this.modules.has(module.id)) return; // Promise.reject(`Module '${module.id}' is already registered.`);
                    if (this.disabledModules.has(module.id)) return;// Promise.reject(`Module '${module.id}' is hard-coded disabled.`);
                    this.modules.set(module.id, module);
                    Logger.log(ILog.Level.Debug, 'Registry', `Registered module '${module.id}'`);

                    module.register();
                    this.client.emit('moduleRegister', module);
                });
                this.client.emit('modulesRegistered');
                resolve()
            } catch (error) {
                Sentry.captureException(error);
                reject(error);
            }
        });
    } // Accepts a direct path too
    deregisterModule(module: MaylogModuleId): Promise<void> {
        return Promise.resolve()
    }
    registerCommand(providedCommand: string | MaylogCommand): Promise<void> {
        if (typeof providedCommand === 'string') {
            // path
            const commandFile = require(providedCommand);
            if (!commandFile || Global.isClass(commandFile)) return Promise.reject('Invalid command path');
            const command: MaylogCommand = new (providedCommand as any)(this.client);
            if (!ModuleIndex[command.module].enabled) return Promise.reject(`Module for '${command.name}' is disabled.`);
            if (this.commands.has(command.name)) return Promise.reject(`Command '${command.name}' is already registered.`);
            if (this.disabledCommands.has(command.name)) return Promise.reject(`Command '${command.name}' is hard-coded disabled.`);
            this.commands.set(command.name, command);
            Logger.log(ILog.Level.Debug, 'Registry', `Registered command ${command.module}:${command.name}`);
            this.client.emit('commandRegister', command);
        } else {
            // command object
            if (this.commands.has(providedCommand.name)) return Promise.reject(`Command '${providedCommand.name}' is already registered.`);
            if (this.disabledCommands.has(providedCommand.name)) return Promise.reject(`Command '${providedCommand.name}' is hard-coded disabled.`);

            Logger.log(ILog.Level.Debug, 'Registry', `Registered command ${providedCommand.module}:${providedCommand.name}`);
            this.commands.set(providedCommand.name, providedCommand);
            this.client.emit('commandRegister', providedCommand);
        }
        return Promise.resolve()
    }
    //     module.registerCommand(path.join(module.commandsDirectory, 'BanCommand.ts')); // ts/js/without. doesn't matter. will split by "." anyway //     module.registerCommand(MaylogCommand) // Registers by a Maylog command object
    registerCommands(path: string): Promise<void> { return Promise.resolve() }
    registerEvent(event: MaylogEvent<any>): Promise<void> {
        if (this.disabledEvents.has(event.name)) return Promise.reject(`Event ${event.name} is disabled.`);
        if (this.events.has(event.name)) return Promise.reject(`Event ${event.name} is already enabled.`);
        if (!event.listener) event.trigger();
        if (event.once) this.client.once(event.code, event.listener!); else this.client.on(event.code, event.listener!);

        this.events.set(event.name, event);
        this.client.emit('eventRegistered', event);
        return Promise.resolve();
    }
    deregisterEvent(eventObject: MaylogEvent<any> | string) {
        const event = this.events.get(typeof eventObject === 'string' ? eventObject : eventObject.name);
        if (!event) return;
        if (!event.listener) return;

        this.client.removeListener(event.code, event.listener);
        event.listener = undefined;
        this.events.delete(event.name);
        this.client.emit('eventDeregistered', event);
        return Promise.resolve();
    }
    public publishCommands(target: MaylogEnum.PublishTarget, guildId?: string, commands?: MaylogCommand[]): Promise<void> {
        const isGlobal = target === MaylogEnum.PublishTarget.Global;
        const commandlist = commands ? new Collection(commands.map(c => [ c.name, c ])) : this.commands;
        const processedCommands: any[] = [];
        SlashAPI(commandlist, processedCommands, !isGlobal); // Set up the arguments and whatnot for slash commands, then register with REST

        const restAPI = new REST({ version: '9' }).setToken(this.client.token!);
        if (isGlobal) {
            // restAPI.put(Routes.applicationCommands(this.client.application!.id), { body: processedCommands.map(x => x.toJSON() )})
            restAPI.put(Routes.applicationCommands(this.client.application!.id), { body: processedCommands })
            .then(() => Logger.log(ILog.Level.Info, 'Core', `Registered ${processedCommands.length} global application (/) commands.`))
            .catch(Sentry.captureException);
            // .catch(Sentry.captureException);
        } else {
            if (guildId) {
            } else {
                interface IGuildDictionary { [key: string]: RESTPostAPIChatInputApplicationCommandsJSONBody[] };
                const guilds: IGuildDictionary = {};
                processedCommands.forEach(command => {
                    const data = this.commands.get(command.name);
                    data?.manualGuildRollout?.forEach(id => {
                        if (guilds[id]) {
                            guilds[id].push(command);
                        } else {
                            guilds[id] = [command];
                        }
                    });
                });
                for (const guildId of Object.keys(guilds)) {
                    const commands = guilds[guildId];
                    restAPI.put(Routes.applicationGuildCommands(this.client.application!.id, guildId), { body: commands })
                        .then(() => {
                            Logger.log(ILog.Level.DebugExtended, 'Core', `Commands registered for ${guildId}: [${commands.map(command => command.name).join(', ')}]`);
                            Logger.log(ILog.Level.Info, 'Core', `Registered ${commands.length} guild application commands for ${guildId}`);
                        }).catch(e => Sentry.captureException);
                }
            }
        }

        // this.on('$FORCE_DELETE_GLOBAL_COMMANDS', (commandId: string) => {
        //     Logger.log(ILog.Level.Info, 'Core', 'Following instruction to delete all global commands.')
        //     if (commandId === '*') {
        //         rest.put(Routes.applicationCommands(this.application!.id), { body: [] })
        //             .then(() => Logger.log(ILog.Level.Info, 'Core', `Deleted all global application (/) commands.`))
        //             .catch(console.error);
        //     } else {
        //         rest.delete(Routes.applicationCommand(this.application!.id, commandId))
        //             .then(() => Logger.log(ILog.Level.Info, 'Core', `Deleted global application (/) command ${commandId}.`))
        //             .catch(console.error);
        //     }
        // });
    
        // this.on('$FORCE_DELETE__GUILD_COMMANDS', (guildId: string, commandId: string) => {
        //     Logger.log(ILog.Level.Info, 'Core', 'Following instruction to delete all guild-specific commands')
        //     if (commandId === '*') {
        //         for (const guildId of Object.keys(guilds)) {
        //             rest.put(Routes.applicationGuildCommands(this.application!.id, guildId), { body: [] })
        //                 .then(() => Logger.log(ILog.Level.Info, 'Core', `Deleted all server application (/) commands for guild ${guildId}.`))
        //                 .catch(console.error);
        //         }
        //     } else {
        //         rest.delete(Routes.applicationGuildCommand(this.application!.id, guildId, commandId))
        //             .then(() => Logger.log(ILog.Level.Info, 'Core', `Deleted server application (/) command ${commandId} for guild ${guildId}.`))
        //     }
        // });
        return Promise.resolve();
    }
    unpublishCommand(target: MaylogEnum.PublishTarget.Guild, guildId: string, commandName: string): Promise<void> { return Promise.resolve() }
    unpublishCommands(target: MaylogEnum.PublishTarget): Promise<void> { return Promise.resolve() }
}

// client.Registry.loadModules(path.join(__dirname, 'modules'));
// client.Registry.registerModule(path.join(__dirname, 'modules', 'mod')) // Load moderation module

// client.Registry.modules.forEach(module => {
//     module.registerCommands(module.commandsDirectory);
//     module.registerCommand(path.join(module.commandsDirectory, 'BanCommand.ts')); // ts/js/without. doesn't matter. will split by "." anyway
//     module.registerCommand(MaylogCommand) // Registers by a Maylog command object
//     client.Registry.registerCommand(MaylogCommand) // Registers by maylog command object.
//     // client.Registry.

//     client.registry.publishCommands(MaylogEnum.PublishTarget.Global) // Publishes all registered commands globally
//     client.registry.publishCommands(MaylogEnum.PublishTarget.Guild) // Publish all registered guild-specific commands
//     client.registry.unpublishCommands(MaylogEnum.PublishTarget.Global) // Unpublishes all registered commands globally
//     client.registry.unpublishCommands(MaylogEnum.PublishTarget.Guild) // Unpublishes all registered commands guild-specific
//     client.registry.unpublishCommand(MaylogEnum.PublishTarget.Guild, '123425235', 'commandName') // Unpublishes one specific guild-specific command
//     client.registry.publishCommands(MaylogEnum.PublishTarget.Guild, '123456476323', client.Registry.getGuildCommands()) // Returns guild commands
// })

//> ---------------------
// update global commands
// update guild commands
// get a list of guilds with commands, etc.

// implement like.. context command.. and slash.. and text.. somehow idek

// REGISTRY: Handles registration and searching.. of modules, commands, events
// COMMANDMANAGER:  /** Handles registration and searching of commands and groups */
// EVENTMANAGER: /** Handles registration and searching of events */