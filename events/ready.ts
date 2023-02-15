import { Bot } from '../classes/Bot.js';
import { ActivityType } from 'discord.js';

export const name = 'ready';
export const once = true;

export const exec = async (client: Bot) => {
    console.log(`Logged in as ${client.user?.tag}!`)
    client.user?.setPresence({
        activities: [{
            name: 'not feedback lol',
            type: ActivityType.Listening
        }],
        status: 'idle'
    })
} 