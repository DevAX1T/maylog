import { Awaitable, CacheType, Interaction } from 'discord.js';
import { NSClient } from '../../../../maylog/structures/MaylogClient';
import { MaylogClient } from '../../../../maylog';
import { FuzzyFinder }from '../../../../util/FuzzyFinder';
import MaylogEvent from '../../../../maylog/structures/MaylogEvent';


export default class CommandModuleAutocompleteEvent extends MaylogEvent<'interactionCreate'> {
    public readonly name: string = 'CommandModuleAutocomplete';
    public readonly code: NSClient.KeyofEvents = 'interactionCreate';
    constructor(client: MaylogClient) {
        super(client);
    }
    trigger(): (interaction: Interaction<CacheType>) => Awaitable<void> {
        this.listener = (interaction: Interaction<CacheType>) => {
            if (!interaction.isAutocomplete()) return;
            const options: any = [];
            interaction.client.Registry.commands.filter(c => !c.hide).forEach(c => options.push({ type: 'command', name: c.name, module: c.module }));
            interaction.client.Registry.modules.forEach(m => options.push({ type: 'module', name: m.name, id: m.id }));

            const finder = new FuzzyFinder(options, (x: any) => x.name);
            const focused = interaction.options.getFocused(true);
            if (focused.name !== 'command_or_module') return;
            const found = finder.find((focused.value as string)!.toLowerCase());
            let results: any[] = [];
            if (found.length > 0 && !!focused.value) {
                results = found.map(f => f.item).slice(0, 24).map(f => {
                    return {
                        name: `${f.type === 'module' ? 'Module' : 'Command'}: ${f.name}`,
                        value: f.type === 'module' ? f.id : `${f.module}:${f.name}`
                    };
                });
            }
            interaction.respond(results).catch(() => {});
        }
        return this.listener;
    }
}