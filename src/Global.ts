import { ObjectId } from 'mongodb';
import Constants from './Constants';
import fs from 'fs';
import path from 'path';

export namespace ILog {
    export enum Level {
        Info,
        InfoWhite,
        Connected,
        Debug,
        /** Logs **A LOT MORE** than normal debug. Could crash PC */
        DebugExtended,
        Warning,
        Error,
        FatalError
    }
    export enum Event {
        CommandRun,
        CommandRunSuccessfully,
        CommandRunError
    }
}

export default {
    get debugLevel(): number {
        return this.isProd ? ILog.Level.Info : ILog.Level.DebugExtended;
    },
    /** Returns the cluster the process is currently running on */
    get cluster() {
        return 0;
    },
    get environment() {
        return process.platform === 'win32' ? 'dev' : 'prod';
        // return 'prod'; // Override for production testing
    },
    /** Returns a boolean if the current environment is production. Relies on `<Global>.environment` getter */
    get isProd() {
        return this.environment === 'prod';
    },
    /** getter; database name (prod: maylog; dev: maylog-dev) */
    get db() {
        return this.isProd ? Constants.dbName.prod : Constants.dbName.dev;
    },
    get keys() {
        return {
            guilds: `${this.db}:guilds`,
            users: `${this.db}:users`,
            usersLookup: `${this.db}:users-lookup`,
            log: `${this.db}:activity-logs`
        }
    },
    /** Returns the bot token based on the runtime (e.g. production for Linux) */
    get botToken(): string {
        return (this.isProd ? process.env.TOKEN_PRODUCTION : process.env.TOKEN_DEVELOPMENT) as string;
    },
    /** Return bot version */
    getVersion(): string {
        return Constants.version;
    },
    makeChoicesDictionary(dictionary: Record<string, string>) {
        const choices: { name: string, value: string }[] = [];
        Object.entries(dictionary).forEach(([id, desc]) => choices.push({ name: desc, value: id }));
        return choices;
    },
    makeChoices(...options: string[]) {
        return options.map(o => {
            return { name: o, value: o }
        });
    },
    /**
     * Generate a random number from min to max.
     * @param  {number} min
     * @param  {number} max
     * @returns number
     */
    random(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min)) + min;
    },
    /**
     * Takes a number and outputs ⏣{amount}
     * @important You should wrap *all* currency in this function.
     * @param  {number} amount
     * @returns string
     */
    currency(amount: number, noSymbol: boolean = false): string {
        const result = amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return `${noSymbol ? '' : Constants.cursym}${result}`;
    },
    searchDir(directory: string, execFunction: Function, excludeFiles?: string[], includeFiles?: string[]) {
        const search = (dir: string) => {
            fs.readdirSync(dir).forEach(file => {
                const joined = path.join(dir, file);
                const stat = fs.statSync(joined);
                if (stat.isDirectory()) {
                    search(joined);
                } else if (stat.isFile()) {
                    if (file.endsWith('.map')) return;
                    if (file.startsWith('$')) return;
                    if (excludeFiles && excludeFiles.includes(file.split('.')[0])) return;
                    if (includeFiles && !includeFiles.includes(file.split('.')[0])) return;
                    const _file = require(joined);
                    execFunction(joined, _file);
                }
            })
        }
        search(directory)
    },
    /**
     * Easy shortcut for a wait function
     * @param  {number} timeMs
     * @param  {boolean=false} doReject Rejects with 'promise timed out' if true and times out
     */
    async wait(timeMs: number, doReject: boolean = false) {
        return new Promise<void>((resolve, reject) => {
            setTimeout(() => doReject ? reject('promise timed out') : resolve(), timeMs);
        });
    },
    /**
     * @important Rejects with 'promise timed out' as an error response
     * @param  {Promise<unknown>} promise
     * @param  {number} timeout
     */
    async timeoutPromise(promise: Promise<unknown>, timeout: number) {
        return Promise.race([ promise, this.wait(timeout, true) ])
    },
    isClass(obj: any): boolean {
        const isCtorClass = obj.constructor
            && obj.constructor.toString().substring(0, 5) === 'class'
        if(obj.prototype === undefined) {
          return isCtorClass
        }
        const isPrototypeCtorClass = obj.prototype.constructor 
          && obj.prototype.constructor.toString
          && obj.prototype.constructor.toString().substring(0, 5) === 'class'
        return isCtorClass || isPrototypeCtorClass
    },
    JSONParseReviver(key: any, value: any) {
        if (key === '_id' && ObjectId.isValid(value)) return new ObjectId(value);
        return value;
    }
}
