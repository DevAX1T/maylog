import { MaylogClient, MaylogCommand } from '..';
import { User } from 'discord.js';
import * as Sentry from '@sentry/node';
import CoreDataProvider from '../DataProvider/providers/CoreDataProvider';
import Global from '../../Global';

/** Log statistics about command usage, guilds joined, etc. Should only work after dbConnect() */
export default class Statistics {
    public readonly client: MaylogClient;
    public readonly provider: CoreDataProvider;
    constructor(client: MaylogClient, provider: CoreDataProvider) {
        this.client = client;
        this.provider = provider;
    }
    commandRun(executor: User, command: MaylogCommand) {
        // Mongo the executor
        // Mongo the actual command
        const stats = this.provider.mongo.db(Global.db).collection('statistics');
        const userStats = this.provider.mongo.db(Global.db).collection('user-statistics');
        userStats.updateOne({ _id: executor.id as any }, { $inc: { [`commandUsage.${command.name}`]: 1 } }, { upsert: true }).catch(Sentry.captureException);
        stats.updateOne({ _id: 'commandStats' as any },  { $inc: { [`commandUsage.${command.name}`]: 1 } }, { upsert: true }).catch(Sentry.captureException);
    }
    /** Logs a guild join */
    guildJoin() {
        const coll = this.provider.mongo.db(Global.db).collection('statistics');
        coll.updateOne({ _id: 'guildStats' as any }, { $inc: { joined: 1 } }, { upsert: true }).catch(Sentry.captureException);
    }
    /** Logs a guild leave */
    guildLeave() {
        const coll = this.provider.mongo.db(Global.db).collection('statistics');
        coll.updateOne({ _id: 'guildStats' as any }, { $inc: { left: 1 } }, { upsert: true }).catch(Sentry.captureException);
    }
}