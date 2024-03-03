import { IMaylogGuild } from '../../../structures/core/Guild';

export = {
    name: 'Migrator',
    priority: 0,
    exec: (rawData: IMaylogGuild) => {
        if (!rawData.patches) {
            // Migrate
        }
        return rawData;
    }
}