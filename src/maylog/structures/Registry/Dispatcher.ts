import { Awaitable, CacheType, Interaction } from 'discord.js';
import { ILog } from '../../../Global';
import * as Sentry from '@sentry/node';
import Evaluator from './Evaluator';
import Logger from '../../../util/Logger';
import Registry from '../Registry';
import MaylogClient from '../MaylogClient';



/** The Dispatcher handles parsing, validating, and evaluating commands. */
export default class Dispatcher {
    /**
     * If set to false, {@link Dispatcher} will stop processing interaction create events.
     */
    public isEnabled: boolean = true;
    public readonly client: MaylogClient;
    public readonly Registry: Registry;
    constructor(client: MaylogClient, registry: Registry) {
        this.client = client;
        this.Registry = registry;
        this.client.on('interactionCreate', (i) => {
            if (this.isEnabled) this.onInteractionCreate(i);
        });
    }
    onInteractionCreate(interaction: Interaction<CacheType>): Awaitable<void> {
        if (!interaction.isCommand() || !interaction.channel) return;
        // todo: add Blacklist check.

        try {
            Evaluator(this, interaction);
        } catch (error) {
            Sentry.captureException(error);
            Logger.log(ILog.Level.Error, `Dispatcher`, `Experienced error when running ${interaction.commandName}: ${error}`);
        }
    }
}