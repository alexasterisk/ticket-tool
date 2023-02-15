import { Client, Routes, REST, ClientOptions, ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandSubcommandBuilder, ClientEvents } from 'discord.js';
import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { clientId, guildId } from '../config.json';

export interface Command {
    builder: SlashCommandBuilder;
    exec: (client: Bot, interaction: ChatInputCommandInteraction) => unknown;
    subcommands?: Map<string, Subcommand>;
    name: string;
}

export interface Subcommand {
    builder: SlashCommandSubcommandBuilder;
    exec: (client: Bot, interaction: ChatInputCommandInteraction) => unknown;
    name: string;
}

export interface BotEvent {
    once?: boolean;
    name: keyof ClientEvents;
    exec: (client: Bot, ...args: unknown[]) => void;
}

export class Bot extends Client {
    public commands: Map<string, Command> = new Map();
    public cooldowns: Map<string, Map<string, number>> = new Map();

    public constructor(...intents: string[]) {
        super({ intents: intents as unknown as ClientOptions['intents'] });
    }

    public async start(token?: string): Promise<void> {
        this.loadCommands();
        this.loadEvents();
        await this.login(token ?? Bun.env.DISCORD_TOKEN);
    }

    public async loadCommands(): Promise<boolean> {
        const commandFolder = join(import.meta.url, '..', 'commands');
        for (const file of readdirSync(commandFolder)) {
            if (lstatSync(join(commandFolder, file)).isDirectory()) {
                const subFolder = join(commandFolder, file);
                const index = require(join(subFolder, 'index.js')) as Command;
                index.subcommands = new Map();

                for (const subFile of readdirSync(subFolder).filter(f => f.match(/\.js$/) && !f.match(/^_/) && f !== 'index.js')) {
                    const subcommand = require(join(subFolder, subFile)) as Subcommand;
                    index.subcommands.set(subcommand.name, subcommand);
                    index.builder.addSubcommand(subcommand.builder);
                }

                index.exec = async (client: Bot, interaction: ChatInputCommandInteraction) => {
                    const subcommand = interaction.options.getSubcommand();
                    if (!subcommand) throw new Error('No subcommand provided');
                    const subcommandData = index.subcommands?.get(subcommand);
                    if (!subcommandData) throw new Error('Invalid subcommand provided');
                    await subcommandData.exec(client, interaction);
                }

                this.commands.set(index.name, index);
            } else if (file.match(/\.js$/) && !file.match(/^_/)) {
                const command = require(join(commandFolder, file)) as Command;
                this.commands.set(command.name, command);
            }
        }

        return true;
    }

    public async loadEvents(): Promise<boolean> {
        const eventFolder = join(import.meta.url, '..', 'events');
        for (const file of readdirSync(eventFolder).filter(f => f.match(/\.js$/) && !f.match(/^_/))) {
            const event = require(join(eventFolder, file)) as BotEvent;
            if (event.once) this.once(event.name, (...args) => event.exec(this, ...args));
            else this.on(event.name, (...args) => event.exec(this, ...args));
        }

        return true;
    }

    public async registerCommands(token?: string): Promise<boolean> {
        const rest = new REST({ version: '10' }).setToken(token ?? Bun.env.DISCORD_TOKEN ?? '');
        return await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: [...this.commands.values()].map(c => c.builder.toJSON())
        })
            .then(() => {return true})
            .catch(() => {throw new Error('Failed to register commands')});
    }
}