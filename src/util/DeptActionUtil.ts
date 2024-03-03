import { MaylogCommandContext } from '../maylog/structures/MaylogCommand';
import Constants from '../Constants';
import DataProvider from '../maylog/DataProvider/providers/CoreDataProvider';
import fetch from 'node-fetch';
import Global from '../Global';
import noblox from 'noblox.js';

const BASE_ROVER_URL = `https://registry.rover.link/api`;

const FETCH_LUA_SCRIPT = `
local user = ARGV[1];

local res = redis.pcall('get', '${Global.keys.usersLookup}/' .. tostring(user));
if ((type(res) == 'table') or not res) then return 0 end;

local user = redis.pcall('get', '${Global.keys.users}/' .. tostring(res));
if not user then return 0 end;
if user['err'] then return 0 end;

return user;
`

interface IRobloxData {
    username: string;
    user_id: number;
    avatarURL?: string;
    cachedOn?: number;
}

function doRecache(time: number) {
    return time < Date.now();//< Date.now() + (3600 * 3 * 1000);
}

function getUserFromMention(mention: string): string | void {
	if (!mention) return;

	if (mention.startsWith('<@') && mention.endsWith('>')) {
		mention = mention.slice(2, -1);

		if (mention.startsWith('!')) {
			mention = mention.slice(1);
		}

		return mention;
	}
}
function findAccount(guildId: string, userId: number): Promise<string> {
    return new Promise((resolve, reject) => {
        fetch(`${BASE_ROVER_URL}/guilds/${guildId}/roblox-to-discord/${userId}`, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ROVER_API_KEY}` }
        }).then(async responseRaw => {
            if (responseRaw.status !== 200) return reject();
            const response = await responseRaw.json();
            if (response.discordUsers.length === 0) reject();
            resolve(response.discordUsers[0].user.id);
        }).catch(reject);
    });
}
function cachedFromDiscord(provider: DataProvider, guildId: string, userId: string): Promise<IRobloxData> {
    return new Promise(async (resolve, reject) => {
        provider.redis.get(`${Global.keys.users}/${userId}`).then(async user => {
            if (user) {
                const parsedUser = JSON.parse(user) as IRobloxData;
                if (doRecache(parsedUser.cachedOn!)) {
                    await createRedisCache(provider, parsedUser, guildId, userId);
                    // try {
                    //     parsedUser.avatarURL = await getThumbnail(parsedUser.user_id);
                    // } catch {}
                }
                // Return it lol
                resolve(parsedUser);
            } else {
                // Fetch it all manually, including avatar URL
                // Expire (ms): Constants.expirationMs.user
                // todo: ratelimiting
                fetch(`${BASE_ROVER_URL}/guilds/${guildId}/discord-to-roblox/${userId}`, {
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ROVER_API_KEY}` }
                }).then(async responseRaw => {
                    if (responseRaw.status !== 200) return reject(`Could not find user [REFCODE 3]`);
                    const json = await responseRaw.json();
                    json.cachedOn = Math.floor(Date.now());
                    try {
                        json.avatarURL = await getThumbnail(json.robloxId);
                        const username = await noblox.getUsernameFromId(json.robloxId as number);
                        if (username) json.username = username;
                    } catch {}

                    const savedata: Record<string, string | number> = {
                        username: json.cachedUsername as string,
                        user_id: json.user_id as number
                    };
                    if (json.avatarURL) savedata.avatarURL = json.avatarURL;

                    resolve(savedata as any as IRobloxData);
                    createRedisCache(provider, savedata, guildId, userId);
                }).catch(() => reject(`Could not find user [REFCODE 2]`));
            }
        }).catch(() => reject('Could not find user. [REFCODE 1]'));
    });
}

async function createRedisCache(provider: DataProvider, rodata: any, guildId: string, userId?: string): Promise<void> {
    return new Promise(async resolve => {
        try {
            let account = userId;
            if (!account) {
                try {
                    const data = await findAccount(guildId, rodata.user_id);
                    account = data;
                } catch {}
            }
            if (!account) return;
            rodata.account = account;
            if (doRecache(rodata.cachedOn)) {
                if (!rodata.avatarURL) {
                    try {
                        rodata.avatarURL = await getThumbnail(rodata.user_id);
                    } catch {}
                }
                try {
                    const username = await noblox.getUsernameFromId(rodata.user_id) || rodata.username;
                    if (username) rodata.username = username;
                } catch {}
            }
            rodata.cachedOn = Date.now() + (3600 * 3 * 1000);
            await provider.redis.psetex(`${Global.keys.users}/${account}`, Constants.expirationMs.user, JSON.stringify(rodata)).catch(() => false);
            await provider.redis.psetex(`${Global.keys.usersLookup}/${rodata.user_id}`, Constants.expirationMs.user - 500, account).catch(() => false);
            resolve();
        } catch { resolve() }
    });
}
function parseSubject(context: MaylogCommandContext, subject: string): Promise<IRobloxData> {
    return new Promise(async (resolve, reject) => {
        try {
            if (subject.includes('@')) {
                // Mention. Parse user, call Rover API or cache
                const user = getUserFromMention(subject);
                if (!user) return reject();

                const member = context.guild!.members.cache.get(user);
                if (!member) return reject();

                return resolve(cachedFromDiscord(context.client.DataProvider, context.guild!.id, member.id));
            } else if (subject.startsWith('#')) {
                // Call roblox API or cache, get username
                const userId = Number(subject.slice(1, subject.length));
                if (!userId || isNaN(userId)) return reject();
                try {
                    const result = await context.client.DataProvider.redis.eval(FETCH_LUA_SCRIPT, 0, userId) as string | 0;
                    if (result === 0) {
                        noblox.getUsernameFromId(userId).then(username => {
                            if (!username) return reject();
                            resolve({ username: username, user_id: userId });
                            createRedisCache(context.client.DataProvider, {
                                username: username,
                                user_id: userId,
                            }, context.guild!.id);
                        }).catch(reject)
                    } else {
                        const parsedResult = JSON.parse(result);
                        if (doRecache(parsedResult.cachedOn)) createRedisCache(context.client.DataProvider, parsedResult, context.guild!.id);
                        resolve(parsedResult);
                    }
                } catch {}
            } else {
                // Call roblox API
                // Get ID from name, then get username to ensure a valid thing
                noblox.getIdFromUsername(subject).then(async id => {
                    if (!id) reject();
                    try {
                        const result = await context.client.DataProvider.redis.eval(FETCH_LUA_SCRIPT, 0, id) as string | 0;
                        if (result === 0) {
                            noblox.getUsernameFromId(id).then(username => {
                                if (!username) reject();
                                resolve({ username: username, user_id: id });
                                createRedisCache(context.client.DataProvider, {
                                    username: username,
                                    user_id: id
                                }, context.guild!.id);
                            }).catch(reject);
                        } else {
                            const parsedResult = JSON.parse(result);
                            if (doRecache(parsedResult.cachedOn)) createRedisCache(context.client.DataProvider, parsedResult, context.guild!.id);
                            resolve(parsedResult);
                        }
                    } catch {
                        reject();
                    }
                }).catch(reject);
            }
        } catch (error) {
            reject(error);
        }
    })
}


/**
 * Gets a Roblox account thumbnail by Roblox ID
 * @param userId The roblox accout
 * @returns A string
 * @important This function always rejects with a string explaining the reason for failure. Resolves with a proper URL.
 */
async function getThumbnail(userId: number): Promise<string> {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await noblox.getPlayerThumbnail(userId, '100x100', 'png', false, 'headshot');
            if (result.length === 0) return reject('Failed to fetch thumbnail [REFCODE 1]');
            const url = result[0].imageUrl;
            if (!url) return reject('Failed to fetch thumbnail [REFCODE 3]');
            resolve(url);
        } catch {
            reject('Failed to fetch thumbnail [REFCODE 2]');
        }
    });
}
// todo: add ratelimiting later. Good chance we'll be fine for now though

export = {
    getThumbnail,
    parseSubject,
    cachedFromDiscord,
    getUserFromMention,
    findAccount
}