import { MaylogArgument, MaylogCommandContext } from '../../../maylog/structures/MaylogCommand';
import { MaylogClient, MaylogCommand, MaylogEnum, UserPermissions } from '../../../maylog';
import * as Sentry from '@sentry/node';
import ConfigOptions from '../../../databases/configOptions';
import errors from '../../../databases/errors';

const commandArguments: MaylogArgument[] = [];

for (const optionId of Object.keys(ConfigOptions)) {
    const option = ConfigOptions[optionId];
    const argument: MaylogArgument = {
        name: optionId,
        description: option.description,
        type: MaylogEnum.Argument.Subcommand,
        arguments: []
    }
    option.arguments?.forEach(arg => argument.arguments!.push(arg));
    if (argument!.arguments!.length === 0) delete argument.arguments;

    commandArguments.push(argument);
}

export = class Command extends MaylogCommand {
    constructor(client: MaylogClient) {
        super(client, {
            name: 'config',
            description: 'Configure mayLOG',
            module: 'info',
            arguments: commandArguments,
            guildOnly: true,
            userPermissions: UserPermissions.ManageGuild
        });
    }
    async run(context: MaylogCommandContext) {
        return new Promise<MaylogEnum.CommandResult>(async resolve => {
            const subcommand = context.arguments.getSubcommand();
            await context.deferReply({ ephemeral: true });
            const guildData = await this.client.DataProvider.guilds.fetch(context.guild!.id);

            this.client.DataProvider.redlock.acquire([ `config:${context.guild!.id}` ]).then(async lock => {
                const option = ConfigOptions[subcommand as keyof typeof ConfigOptions];
                option.exec({ context: context, guild: guildData, lock: lock }).then(result => {
                    lock.release().catch(() => false);
                    context.editReply(result).catch(() => false);
                    return resolve(MaylogEnum.CommandResult.Success);
                }).catch(error => {
                    if (typeof error !== 'string') Sentry.captureException(error);
                    context.editReply('An unknown error occurred when trying to edit the server.').catch(() => false);
                    lock.release().catch(() => false);
                    return resolve(MaylogEnum.CommandResult.Error);
                });
            }).catch(() => {
                context.editReply(errors.ConfigAcquireLock).catch(() => false);
                return resolve(MaylogEnum.CommandResult.Error)
            });
        });
    }
}