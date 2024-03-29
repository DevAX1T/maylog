import MaylogGuild, { IMaylogGuild } from '../../structures/core/Guild';
import * as Sentry from '@sentry/node';
import CoreDataProvider from './../CoreDataProvider';
import Global from '../../../../Global';
import path from 'path';
import Migrator from './Migrator';


interface IDataTransformer {
    name: string;
    priority: number;
    exec: (data: any) => any;
}

export default class GuildDataProvider {
    public readonly core: CoreDataProvider;
    public readonly transformersDir: string;
    public transformers: IDataTransformer[] = [];
    constructor(core: CoreDataProvider) {
        this.core = core;
        this.transformersDir = path.join(__dirname, 'transformers');
        
        Global.searchDir(this.transformersDir, (_: string, TransformerFile: any) => {
            if (!TransformerFile.priority) TransformerFile.priority = 1;
            this.transformers.push(TransformerFile);
        });
    }
    transformData<T>(data: any): T {
        let rawData = data;
        for (const transformer of this.transformers.sort((a, b) => a.priority - b.priority)) {
            rawData = transformer.exec(rawData);
        }
        return rawData as T;
    }
    fetch(guildId: string): Promise<IMaylogGuild> {
        return new Promise(async (resolve, reject) => {
            // Check redis for a guild backup and take that
            // Otherwise, compile it both from mongo, upload to redis, and return
            const fetchMongo = () => {
                this.core.mongo.db(Global.db).collection('guilds').findOne<IMaylogGuild>({ _id: guildId }).then(guild => {
                    if (!guild) {
                        const clone = structuredClone(MaylogGuild);
                        clone._id = guildId;
                        resolve(this.transformData(clone));
                    } else {
                        if (!guild.version) guild = Migrator(guild as any);
                        let guildData = Object.assign({}, MaylogGuild, guild);
                        guildData.config = Object.assign({}, MaylogGuild.config, guild.config);
                        resolve(this.transformData(guildData));
                    }
                }).catch(reject);
            }
            try {
                const rawGuildData = await this.core.redis.get(`${Global.db}:guilds:${guildId}`);
                // renew guild
                if (rawGuildData) {
                    let guild = JSON.parse(rawGuildData);
                    if (!guild.version) guild = Migrator(guild);
                    let guildData = Object.assign({}, MaylogGuild, guild);
                    guildData.config = Object.assign({}, MaylogGuild.config, guild.config);
                    resolve(this.transformData(guildData));
                } else {
                    fetchMongo();
                }
            } catch (error) {
                Sentry.captureException(error);
                reject(error);
            }
        });
    }
    update(guildId: string, guildData: IMaylogGuild): Promise<void> {
        return new Promise((resolve, reject) => {
            const promises = [
                this.core.mongo.db(Global.db).collection('guilds').updateOne({ _id: guildId }, { $set: guildData }, { upsert: true }),
                this.core.redis.setex(`${Global.db}:guilds:${guildId}`, 3600, JSON.stringify(guildData))
            ];
            Promise.all(promises).then(() => resolve()).catch(reject);
        });
    }
}