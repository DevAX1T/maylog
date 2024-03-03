import { Event, EventHint } from '@sentry/node';
import Global, { ILog } from '../Global';
import Logger from './Logger';

export default (event: Event, _: EventHint): Event | null => {
    let toReturn: any = event;
    try {
        if (event.exception && event.exception.values) {
            event.exception.values.forEach(exception => {
                if (exception.value && exception.value === 'read ECONNRESET') return toReturn = null;
                if (true) {// Tempfix because of sentry block !Global.isProd) {
                    if (!exception.stacktrace?.frames) return;
                    let msg = '';
                    exception.stacktrace.frames.reverse().forEach(f => {
                        try {
                            msg += `\n at ${f.function} (${f.filename}:${f.lineno}:${f.colno})`;
                        } catch (e) {}
                    });
                    Logger.log(ILog.Level.Error, 'Core', `Sentry error: ${exception.value}${msg}`);
                    console.error(exception.value, msg);
                }
            });
        }
    } catch {};
    return toReturn;
}