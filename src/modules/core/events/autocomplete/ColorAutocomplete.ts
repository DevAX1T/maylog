import { Awaitable, CacheType, Interaction } from 'discord.js';
import { FuzzyFinder }from '../../../../util/FuzzyFinder';
import { MaylogClient } from '../../../../maylog';
import { NSClient } from '../../../../maylog/structures/MaylogClient';
import colors from '../../../../databases/colors';
import MaylogEvent from '../../../../maylog/structures/MaylogEvent';

const finder = new FuzzyFinder<string>(colors.keys(), x => x.toLowerCase());

export default class ColorAutocompleteEvent extends MaylogEvent<'interactionCreate'> {
    public readonly name: string = 'ColorAutocomplete';
    public readonly code: NSClient.KeyofEvents = 'interactionCreate';
    constructor(client: MaylogClient) {
        super(client);
    }
    trigger(): (interaction: Interaction<CacheType>) => Awaitable<void> {
        this.listener = (interaction: Interaction<CacheType>) => {
            if (!interaction.isAutocomplete()) return;
            const focused = interaction.options.getFocused(true);
            if (focused.name !== 'preset_color') return;
            const found = finder.find((focused.value as string)!.toLowerCase());
            let results = colors.keys().slice(0, 24).map(t => {
                return { name: t, value: t };
            });
            if (found.length > 0 && !!focused.value) {
                results = found.map(f => f.item).slice(0, 24).map(f => {
                    return { name: f, value: f };
                });
            } else results = found.length > 0 ? results : [];
            interaction.respond(results).catch(() => {});
        }
        return this.listener;
    }
}