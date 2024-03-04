import { Event, EventHint } from '@sentry/node';
import Global, { ILog } from '../Global';
import Logger from './Logger';

export default (event: Event, hint: EventHint): Event | null => {
    let toReturn: any = event;
    try {
        const error = hint.originalException as Error;
        if (error.message === 'read ECONNRESET') return toReturn = null;
        if (Global.debugLevel === ILog.Level.DebugExtended || !Global.isProd) {
            Logger.log(ILog.Level.Error, 'Core', `Sentry error: ${error}`);
            console.log(error);
        }
    } catch {};
    return toReturn;
}