import { MongoClientOptions, MongoOptions } from 'mongodb';
import { RedisOptions } from 'ioredis'
export interface IProviderOptions {
    mongo: {
        srv: string;
        clientOptions: MongoClientOptions;
    };
    redis: {
        clientOptions: RedisOptions;
    }
}

// const PROVIDER_INFORMATION = {
//     manualLoad: false,
//     using: [ 'mongo', 'redis' ],
//     authentication: {
//         mongo: {
//             authentication: { srv: '' },
//             tlsCAFile: path.join(__dirname, 'certificates', Constants.dbName.mongoCertificationName)
//         },
//         redis: {
//             authentication: { ip: process.env.REDIS_HOST, password: process.env.REDIS_PASSWORD }
//         }
//     }
// };