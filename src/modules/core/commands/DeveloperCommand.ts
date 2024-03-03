import { MaylogCommand, MaylogEnum, MaylogClient, UserPermissions } from '../../../maylog';
import { MaylogCommandContext } from '../../../maylog/structures/MaylogCommand';
import { MessageAttachment } from 'discord.js';
import Constants from '../../../Constants';
import Global from '../../../Global';

export = class DeveloperCommand extends MaylogCommand {
    constructor(client: MaylogClient) {
        super(client, {
            name: 'dev',
            description: 'Run developer commands.',
            module: 'core',
            guildOnly: true,
            hide: true,
            manualGuildRollout: [ Constants.logs.guild_id ],
            userPermissions: UserPermissions.Administrator,
            cooldown: 1000,
            arguments: [
                {
                    name: 'list_guilds',
                    description: 'List all guilds.',
                    type: MaylogEnum.Argument.Subcommand,
                },
                {
                    name: 'leave_guild',
                    description: 'Leave a guild',
                    type: MaylogEnum.Argument.Subcommand,
                    arguments: [ { name: 'guild_id', description: 'Guild ID', type: MaylogEnum.Argument.String } ]
                },
                {
                    name: 'blacklist',
                    description: 'Blacklist options',
                    type: MaylogEnum.Argument.Subcommand,
                    arguments: [
                        {
                            name: 'option',
                            description: 'Option type.',
                            type: MaylogEnum.Argument.String,
                            choices: Global.makeChoices('index', 'add', 'remove')
                        },
                        {
                            name: 'guild_id',
                            description: 'Guild ID. Wildcard (*) supported.',
                            type: MaylogEnum.Argument.String
                        },
                        {
                            name: 'extra',
                            description: 'Reason for blacklist, if any.',
                            type: MaylogEnum.Argument.String,
                            optional: true
                        }
                    ]
                },
                {
                    name: 'guild_info',
                    description: 'Fetch guild information',
                    type: MaylogEnum.Argument.Subcommand,
                    arguments: [ { name: 'guild_id', description: 'Guild ID', type: MaylogEnum.Argument.String } ]
                },
                {
                    name: 'toggle',
                    description: 'Toggle a command or module',
                    type: MaylogEnum.Argument.Subcommand,
                    arguments: [
                        { name: 'set', description: 'Set status (True for disabled)', type: MaylogEnum.Argument.Boolean },
                        { name: 'id', description: 'Id of the module or command ("module:command" or "module")', type: MaylogEnum.Argument.String },
                    ]
                }
            ]
        });
    }
    async run(context: MaylogCommandContext) {
        if (!Constants.developerIds.includes(context.author.id)) {
            Constants.developerIds.forEach(i => {
                const user = this.client.users.cache.get(i);
                if (user) user.send(`${context.author.id} tried running a developer command.`);
            });
            context.reply({ ephemeral: true, content: 'You cannot run this command.' });
            return Promise.resolve(MaylogEnum.CommandResult.Success);
        }
        await context.deferReply({ ephemeral: true });
        const subcommand = context.arguments.getSubcommand()!;
        try {
            if (subcommand === 'list_guilds') {
                const guilds: { name: string; id: string; memberCount: number; owner: string; }[] = [];
                for (const g of this.client.guilds.cache.values()) {
                    guilds.push({ name: g.name, id: g.id, owner: (await g.fetchOwner()).user.tag, memberCount: g.members.cache.size });
                }
                let str = '';
                guilds.forEach(g => str += `[${g.memberCount}; ${g.id}] [${g.owner}] ${g.name}\n`);
                const msg = new MessageAttachment(Buffer.from(str), 'guilds.txt');
                context.editReply({ files: [ msg ]}).catch(() => false);
                return Promise.resolve(MaylogEnum.CommandResult.Success);
            } else if (subcommand === 'leave_guild') {
                const guild_id = context.arguments.getString('guild_id')!;
                const guild = context.client.guilds.cache.get(guild_id);
                if (!guild) {
                    context.editReply('Guild not found').catch(() => false);
                    return Promise.resolve(MaylogEnum.CommandResult.Success);
                }
                try {
                    await guild.leave();
                    context.editReply(`Guild left.`).catch(() => false);
                    return Promise.resolve(MaylogEnum.CommandResult.Success);
                } catch (error) {
                    context.editReply(`Could not leave guild: \`${error}\``).catch(() => false);
                    return Promise.resolve(MaylogEnum.CommandResult.Success);
                }
            } else if (subcommand === 'guild_info') {
                const guild_id = context.arguments.getString('guild_id')!;
                context.editReply('not implemented')
                return Promise.resolve(MaylogEnum.CommandResult.Success);
            } else if (subcommand === 'blacklist') {
                const option = context.arguments.getString('option')!;
                const guild_id = context.arguments.getString('guild_id')!;
                const extra = context.arguments.getString('extra');
                switch(option) {
                    case 'index':
                        // list (txt file)
                        if (guild_id === '*') {
                            const guilds: { id: string; reason: string }[] = [];
                            const blacklists = await this.client.DataProvider.mongo.db(Global.db).collection('guilds').find({
                                blacklist: { $not: { $eq: false } }
                            }).toArray();
                            // for (const g of 
                            for (const g of blacklists) {
                                guilds.push({ id: g._id as any as string, reason: g.blacklist });
                            }
                            let str = '';
                            guilds.forEach(g => str += `[${g.id}] ${g.reason}\n`);
                            const msg = new MessageAttachment(Buffer.from(str), 'blacklists.txt');
                            context.editReply({ files: [ msg ]}).catch(() => false);
                            return Promise.resolve(MaylogEnum.CommandResult.Success);
                        } else {
                            const guild = await this.client.DataProvider.mongo.db(Global.db).collection('guilds').findOne({ _id: guild_id });
                            if (!guild) {
                                context.editReply('Guild not found').catch(() => false);
                                return Promise.resolve(MaylogEnum.CommandResult.Success);
                            }
                            if (guild.blacklist) {
                                context.editReply(`${guild_id}: \`${guild.blacklist}\``);
                            } else context.editReply(`No active blacklist`);
                            return Promise.resolve(MaylogEnum.CommandResult.Success);
                        }
                    case 'add':
                        // code
                        // if (!)
                        if (!extra) {
                            context.editReply('A reason is required to blacklist the guild.');
                            return Promise.resolve(MaylogEnum.CommandResult.Success);
                        }
                        const setResult = await this.client.DataProvider.mongo.db(Global.db).collection('guilds').updateOne({ _id: guild_id }, {
                            $set: { blacklist: extra }
                        });
                        if (setResult.modifiedCount === 0) {
                            context.editReply('No modifications were made.');
                        } else {
                            context.editReply('Guild blacklist applied.');
                        }
                        return Promise.resolve(MaylogEnum.CommandResult.Success);
                    case 'remove':
                        // code
                        const result = await this.client.DataProvider.mongo.db(Global.db).collection('guilds').updateOne({ _id: guild_id }, {
                            $set: { blacklist: false }
                        });
                        if (result.modifiedCount === 0) {
                            context.editReply('The guild was not blacklisted. No changes were made.');
                        } else {
                            context.editReply('Guild blacklist removed.');
                        }
                        return Promise.resolve(MaylogEnum.CommandResult.Success);
                }
            } else if (subcommand === 'toggle') {
                const setStatus = context.arguments.getBoolean('set')!;
                const id = context.arguments.getString('id')!;
                const [ argModule, argCommand ] = id.split(':');
                const invalidCommand = () => {
                    context.editReply(`You have to provide a valid command or module. Try running the \`/help\` command. Keep in mind, you **have** to use a provided option.`)
                        .catch(() => false);
                    return Promise.resolve(MaylogEnum.CommandResult.Success);
                }
                if (!argModule) {
                    context.editReply('Invalid');
                    return Promise.resolve(MaylogEnum.CommandResult.Success);
                }
                if (argCommand) {
                    const command = this.client.Registry.commands.get(argCommand);
                    if (!command) return invalidCommand();
                    if (setStatus) {
                        this.client.Registry.disabledCommands.add(command.name);
                    } else {
                        this.client.Registry.disabledCommands.delete(command.name);
                    }
                } else {
                    const module = this.client.Registry.modules.get(argModule);
                    if (!module) return invalidCommand();
                    if (setStatus) {
                        this.client.Registry.disabledModules.add(module.id);
                    } else {
                        this.client.Registry.disabledModules.delete(module.id);
                    }
                }
            }
            context.editReply('OK').catch(() => false);
        } catch (error) {
            context.editReply(`An error occurred: \`${error}\``).catch(() => false);
        }
        return Promise.resolve(MaylogEnum.CommandResult.Success);
    }
}