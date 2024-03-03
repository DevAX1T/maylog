import { MaylogCommand, MaylogClient, MaylogEnum } from '../../../maylog';
import { MaylogCommandContext } from '../../../maylog/structures/MaylogCommand';

export = class PingCommand extends MaylogCommand {
    constructor(client: MaylogClient) {
        super(client, {
            name: 'ping',
            description: 'Run the ping command.',
            module: 'info'
        });
    }
    async run(context: MaylogCommandContext) {
        context.reply({ content: `:ping_pong: Pong! Latency to Discord: ${context.client.ws.ping}ms` });
        return Promise.resolve(MaylogEnum.CommandResult.Success);
    }
}