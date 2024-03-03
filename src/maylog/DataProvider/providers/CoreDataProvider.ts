import { IProviderOptions, } from '../structures/core/Provider';
import { MongoClient } from 'mongodb';
import * as Sentry from '@sentry/node';
import Global, { ILog } from '../../../Global';
import GuildDataProvider from './GuildDataProvider';
import Logger from '../../../util/Logger';
import Redis from 'ioredis';
import MaylogClient from '../../structures/MaylogClient';
import Redlock from '../Redlock';

export default class DataProvider {
    public readonly client: MaylogClient;
    public readonly redis: Redis;
    public readonly mongo: MongoClient;
    public readonly guilds: GuildDataProvider;
    public readonly redlock: Redlock;
    constructor(client: MaylogClient, providerOptions: IProviderOptions) {
        this.client = client;
        this.guilds = new GuildDataProvider(this);
        this.redis = new Redis(providerOptions.redis.clientOptions);
        this.mongo = new MongoClient(providerOptions.mongo.srv, providerOptions.mongo.clientOptions);
        this.redlock = new Redlock([ this.redis ], { name: 'locks/maylog' });

        this.redis.on('error', (error: Error) => {
            if (error?.message?.includes('ECONNRESET')) return;
            Sentry.captureException(error);
            Logger.log(ILog.Level.Error, 'Redis', `Database error: ${error}`);
        });
        this.mongo.on('error', error => {
            Sentry.captureException(error);
            Logger.log(ILog.Level.Error, 'Mongo', `Database error: ${error}`);
        });
        
        
    }
    async dbConnect(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                Logger.log(ILog.Level.Info, 'Redis', 'Connecting to database.');
                await Global.timeoutPromise(this.redis.connect(), 20000);
                Logger.log(ILog.Level.Connected, 'Redis', 'Database connection established.');

                Logger.log(ILog.Level.Info, 'Mongo', 'Connecting to database');
                await Global.timeoutPromise(this.mongo.connect(), 20000);
                Logger.log(ILog.Level.Connected, 'Mongo', 'Database connection established');
                resolve();
            } catch (error) {
                reject();
                if (error === 'promise timed out') {
                    console.log('Timed out connecting to databases');
                } else {
                    console.log('Error connecting to databases: ', error);
                }
            }
        });
    }
}