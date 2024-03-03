import { DateTime } from 'luxon';
import { IModuleIndex, MaylogModuleId } from '../modules';
import { ModuleIndex } from '../modules';
import { MaylogCommandContext } from '../maylog/structures/MaylogCommand';
import chalk, { Chalk } from 'chalk';
import Global, { ILog } from '../Global';

export default Object.freeze({
    chalk: chalk,
    log(level: ILog.Level, title: string | false, context: string, cluster?: number) {
        cluster = cluster || Global.cluster;
        let moduleData: IModuleIndex | undefined;
        if (title && Object.hasOwn(ModuleIndex, title.toLowerCase())) moduleData = ModuleIndex[title.toLowerCase() as MaylogModuleId];
        const timeFormat = DateTime.now().setZone('America/Los_Angeles').toFormat(`hh:mm:ss a`)
        let logMessage = `${cluster === -1 ? '' : `[C${cluster}]`} [${timeFormat}]`;
        
        const colors: Record<ILog.Level, [label: string, color: Chalk]> = {
            [ILog.Level.Info]:          [ 'INFO',        chalk.green        ],
            [ILog.Level.InfoWhite]:     [ 'INFO',        chalk.white        ],
            [ILog.Level.Connected]:     [ 'CONNECTED',   chalk.green        ],
            [ILog.Level.Debug]:         [ 'DEBUG',       chalk.blueBright   ],
            [ILog.Level.DebugExtended]: [ 'DEBUG',       chalk.cyanBright   ],
            [ILog.Level.Warning]:       [ 'WARN',        chalk.yellowBright ],
            [ILog.Level.Error]:         [ 'ERROR',       chalk.redBright    ],
            [ILog.Level.FatalError]:    [ 'FATAL ERROR', chalk.red          ]
        }
        const getTitleColor = (): Chalk => {
            if (typeof title !== 'string') return chalk.white;
            const list: Record<string, Chalk> = {
                System: chalk.magenta,
                Maylog: chalk.magenta,
                MongoDB: chalk.green,
                Mongo: chalk.green,
                Redis: chalk.red
            }
            if (list[title]) return list[title];
            if (moduleData) return moduleData.color;
            return chalk.white;
        }
        const [ message, color ] = colors[level];
        
        const titleText = title ? ` ${getTitleColor()(`[${moduleData ? moduleData.name : title}]`)}` : '';
        logMessage += ` ${color(`[${message}]`)}${titleText} ${context}`;

        switch(level) {
            case ILog.Level.Error:
            case ILog.Level.FatalError:
                console.error(logMessage);
                break;
            case ILog.Level.DebugExtended:
                if (Global.debugLevel === ILog.Level.DebugExtended && level === ILog.Level.DebugExtended) console.debug(logMessage);
                break;
            case ILog.Level.Debug:
                if (Global.debugLevel === ILog.Level.DebugExtended || Global.debugLevel === ILog.Level.Debug) console.debug(logMessage);
                break;
            default:
                console.log(logMessage);
                break;
        }
    },
    /**
     * Turns the module color by ID
     * @returns Chalk
     */
    moduleColor(id: MaylogModuleId): Chalk {
        return ModuleIndex[id].color;
    },
    /**
     * Returns a JSON string of the context
     * @param  {MaylogCommandContext} context
     * @returns string
     */
    serializeCommandContext(context: MaylogCommandContext): string {
        return JSON.stringify({
            commandName: context.command.name,
            interactionCreatedTimestamp: context.interaction.createdTimestamp,
            author: context.author.id,
            guild: context.interaction.guildId || false,
            channelId: context.interaction.channelId || false,
            arguments: context.arguments.data
        });
    }
});