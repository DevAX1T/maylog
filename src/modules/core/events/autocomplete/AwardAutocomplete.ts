import { Awaitable, CacheType, Interaction } from 'discord.js';
import { FuzzyFinder }from '../../../../util/FuzzyFinder';
import { MaylogClient } from '../../../../maylog';
import { NSClient } from '../../../../maylog/structures/MaylogClient';
import MaylogEvent from '../../../../maylog/structures/MaylogEvent';


export default class AwardAutocompleteEvent extends MaylogEvent<'interactionCreate'> {
    public readonly name: string = 'AwardAutocomplete';
    public readonly code: NSClient.KeyofEvents = 'interactionCreate';
    constructor(client: MaylogClient) {
        super(client);
    }
    trigger(): (interaction: Interaction<CacheType>) => Awaitable<void> {
        this.listener = async (interaction: Interaction<CacheType>) => {
            if (!interaction.isAutocomplete()) return;
            const focused = interaction.options.getFocused(true);
            if (focused.name !== 'award') return;
            if (!interaction.guild) return;
            try {
                const guild = await interaction.client.DataProvider.guilds.fetch(interaction.guild.id);
                if (guild.config.awards.length === 0) {
                    interaction.respond([
                        { name: 'This server has no awards!', value: '-' },
                        { name: 'Run /config set_awards to create awards!', value: '-' }
                    ]).catch(() => false);
                    return;
                }
                const finder = new FuzzyFinder<string>(guild.config.awards, x => x.toLowerCase());
                const found = finder.find((focused.value as string)!.toLowerCase());
                let results = guild.config.awards.slice(0, 24).map(t => {
                    return { name: t, value: t };
                });
                if (found.length > 0 && !!focused.value) {
                    results = found.map(f => f.item).slice(0, 24).map(f => {
                        return { name: f, value: f };
                    });
                } else results = found.length > 0 ? results : [];
                interaction.respond(results).catch(() => false);
            } catch {
                interaction.respond([]).catch(() => false);
            }
        }
        return this.listener;
    }
}