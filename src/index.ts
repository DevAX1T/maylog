import { IProviderOptions } from './maylog/DataProvider';
import { MaylogClient, MaylogEnum } from './maylog';
import * as Sentry from '@sentry/node';
import chalk from 'chalk';
import Constants from './Constants';
import dotenv from 'dotenv';
import Global, { ILog } from './Global';
import Logger from './util/Logger';
import path from 'path';
import SentryBeforeSend from './util/SentryBeforeSend';
dotenv.config();

/** Disabled commands are hardcoded and cannot be registered (sorted by name) */
const HARDCODED_DISABLED_COMMANDS: string[] = []; // no clue if this even works tbh
const PROVIDER_INFORMATION: IProviderOptions = {
    mongo: {
        srv: process.env.MONGO_URI as string
    },
    redis: {
        clientOptions: {
            host: process.env.REDIS_HOST as string,
            password: process.env.REDIS_PASSWORD as string,
            lazyConnect: true,
            reconnectOnError: (error) => {
                console.log(`Failed to connect to redis: ${error}`);
                return true;
            }
        }
    }
}

const environmentText = Global.isProd ? chalk.yellowBright('production') : chalk.green('development');
Logger.log(ILog.Level.Info, 'System', `Starting Maylog [${environmentText} ${Constants.version}]`);

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enabled: Global.isProd,
    environment: Global.isProd ? 'production' : 'development',
    beforeSend(event, hint) { return SentryBeforeSend(event, hint) },
});

const client = new MaylogClient({
    intents: Constants.intents,
    defaultPrefix: Constants.defaultPrefix,
    dirname: __dirname,
    providers: PROVIDER_INFORMATION,
    partials: [ 'MESSAGE', 'CHANNEL' ]
});

// Modules automatically register commands and events!
try {
    HARDCODED_DISABLED_COMMANDS.forEach(m => client.Registry.disabledCommands.add(m));
    client.Registry.registerModules(path.join(__dirname, 'modules'));

    client.on('ready', () => {
        client.user!.setPresence({
            status: 'online',
            activities: [ { type: 'PLAYING', name: 'with department logs'} ]
        });
    });

    client.login(Global.botToken).then(async () => {
        Logger.log(ILog.Level.Connected, 'Maylog', `Connected to Discord. Using '${client.user?.tag}'`);
        Logger.log(ILog.Level.DebugExtended, 'Maylog', `Registering all slash commands.`);
        try {
            client.Registry.publishCommands(MaylogEnum.PublishTarget.Global);
            client.Registry.publishCommands(MaylogEnum.PublishTarget.Guild);
        } catch (error) {
            console.log(error);
            Sentry.captureException(error);
            Logger.log(ILog.Level.FatalError, `Maylog`, `Failed to <Registry.publish()> commands`);
        }
    }).catch(error => {
        Logger.log(ILog.Level.FatalError, `Maylog`, `Failed to login to Discord: ${error}`);
    });
} catch (error) {
    Sentry.captureException(error);
    Logger.log(client.isReady() ? ILog.Level.Error : ILog.Level.FatalError, 'System', `Error while running initial start function: ${error}`);
    if (!client.isReady()) process.exit(1);
}


process.on('unhandledRejection', error => {
    Sentry.captureException(error);
    Logger.log(ILog.Level.Error, 'System', `Unhandled rejection error: ${error}`);
});

process.on('uncaughtException', exception => {
    Sentry.captureException(exception);
    Logger.log(ILog.Level.Error, 'System', `Uncaught exception error: ${exception}`);
});