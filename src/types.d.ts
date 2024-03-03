import { MaylogClient } from './maylog';

export * from 'discord.js';


declare global {
    namespace NodeJS {
        interface ProcessEnv {
            MONGO_URI:                 string;
            REDIS_HOST:                string;
            REDIS_PASSWORD:            string;
            TOKEN_PRODUCTION:          string;
            TOKEN_DEVELOPMENT:         string;
            /** Bot invite link */
            INVITE_LINK:               string;
            SENTRY_DSN:                string;
            ROVER_API_KEY:             string;
        }
    }
}

declare module 'discord.js' {
    interface Interaction {
        client: MaylogClient;
    }
    interface Message {
        client: MaylogClient;
    }
    interface Shard {
        client: MaylogClient;
    }
}