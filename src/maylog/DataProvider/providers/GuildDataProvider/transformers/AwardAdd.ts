import { IMaylogGuild } from '../../../structures/core/Guild';

export = {
    name: 'AwardAdd',
    priority: 0,
    exec: (rawData: IMaylogGuild) => {
        if (rawData.patches.includes('AwardModifier')) return rawData;
        rawData.patches.push('AwardModifier');
        if (!rawData.config.channels.award) rawData.config.channels.award = '';
        return rawData;
    }
}