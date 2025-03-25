import { config } from 'dotenv';
import { 
    Client, 
    Guild, 
    Role, 
    TextChannel, 
    VoiceChannel, 
    CategoryChannel, 
    PermissionOverwrites, 
    Permissions,
    OverwriteType
} from 'discord.js-selfbot-v13';

// Load environment variables
config();

// Bot configuration
const TOKEN = process.env.DISCORD_TOKEN;
const SOURCE_GUILD_ID = process.env.SOURCE_GUILD_ID ? process.env.SOURCE_GUILD_ID : '';
const TARGET_GUILD_ID = process.env.TARGET_GUILD_ID ? process.env.TARGET_GUILD_ID : '';

if (!TOKEN) {
    console.error('DISCORD_TOKEN not found in .env file');
    process.exit(1);
}

if (!SOURCE_GUILD_ID) {
    console.error('SOURCE_GUILD_ID not found in .env file');
    process.exit(1);
}

if (!TARGET_GUILD_ID) {
    console.error('TARGET_GUILD_ID not found in .env file');
    process.exit(1);
}

const client = new Client({
    checkUpdate: false
});

interface RoleMapping {
    [key: string]: string;
}

interface PermissionOverwriteData {
    id: string;
    type: OverwriteType;
    allow: Readonly<Permissions>;
    deny: Readonly<Permissions>;
}

client.on('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}`);
    await copyServer();
    process.exit(0);
});

async function copyServer(): Promise<void> {
    try {
        // Get source and target guilds
        const sourceGuild = client.guilds.cache.get(SOURCE_GUILD_ID);
        const targetGuild = client.guilds.cache.get(TARGET_GUILD_ID);

        if (!sourceGuild) {
            console.error('Source guild not found. Check SOURCE_GUILD_ID in .env file');
            return;
        }

        if (!targetGuild) {
            console.error('Target guild not found. Check TARGET_GUILD_ID in .env file');
            return;
        }

        console.log(`Starting copy process from "${sourceGuild.name}" to "${targetGuild.name}"...`);

        // Delete all existing channels in target guild
        console.log('Deleting existing channels...');
        const systemChannelIds = new Set([
            targetGuild.rulesChannelId,
            targetGuild.publicUpdatesChannelId,
            targetGuild.systemChannelId
        ]);

        for (const channel of targetGuild.channels.cache.values()) {
            try {
                if (!systemChannelIds.has(channel.id)) {
                    await channel.delete();
                } else {
                    console.log(`Skipping system channel: ${channel.name}`);
                }
            } catch (error: any) {
                console.warn(`Could not delete channel ${channel.name}:`, error);
            }
        }

        // Delete all existing roles in target guild
        console.log('Deleting existing roles...');
        for (const role of targetGuild.roles.cache.values()) {
            if (role.name !== '@everyone') {
                try {
                    await role.delete();
                } catch (error: any) {
                    if (error.code === 50028) { // Invalid Role
                        console.log(`Skipping role that cannot be deleted: ${role.name}`);
                        continue;
                    }
                    console.warn(`Could not delete role ${role.name}:`, error);
                }
            }
        }

        // Copy roles first
        console.log('Copying roles...');
        const roleMapping: RoleMapping = {};
        
        // Sort roles by position (highest to lowest)
        const sortedRoles = Array.from(sourceGuild.roles.cache.values())
            .sort((a, b) => b.position - a.position);

        // Copy roles in order
        for (const role of sortedRoles) {
            if (role.name !== '@everyone') {
                const newRole = await targetGuild.roles.create({
                    name: role.name,
                    color: role.color,
                    hoist: role.hoist,
                    mentionable: role.mentionable,
                    permissions: role.permissions,
                    position: role.position
                });
                roleMapping[role.id] = newRole.id;
                console.log(`Created role: ${role.name}`);

                // Set position explicitly to match source
                try {
                    await newRole.setPosition(role.position);
                } catch (error) {
                    console.warn(`Could not set position for role ${role.name}:`, error);
                }
            }
        }

        // Copy channels
        console.log('Copying channels...');
        
        // Get all channels sorted by position
        const allChannels = Array.from(sourceGuild.channels.cache.values())
            .filter(channel => 'position' in channel)
            .sort((a, b) => {
                const posA = 'position' in a ? a.position : 0;
                const posB = 'position' in b ? b.position : 0;
                return posA - posB;
            });

        // First, create categories
        const categoryMap = new Map<string, string>();
        for (const channel of allChannels) {
            if (channel.type === 'GUILD_CATEGORY') {
                const cat = channel as CategoryChannel;
                const newCategory = await targetGuild.channels.create(cat.name, {
                    type: 'GUILD_CATEGORY',
                    position: cat.position,
                    permissionOverwrites: [
                        {
                            id: targetGuild.roles.everyone.id,
                            type: 'role' as OverwriteType,
                            allow: cat.permissionOverwrites.cache.get(sourceGuild.roles.everyone.id)?.allow || new Permissions(),
                            deny: cat.permissionOverwrites.cache.get(sourceGuild.roles.everyone.id)?.deny || new Permissions()
                        },
                        {
                            id: client.user!.id,
                            type: 'member' as OverwriteType,
                            allow: cat.permissionOverwrites.cache.get(client.user!.id)?.allow || new Permissions(),
                            deny: cat.permissionOverwrites.cache.get(client.user!.id)?.deny || new Permissions()
                        }
                    ]
                });
                categoryMap.set(cat.id, newCategory.id);
                console.log(`Created category: ${cat.name}`);

                // Set position explicitly
                try {
                    await newCategory.setPosition(cat.position);
                } catch (error) {
                    console.warn(`Could not set position for category ${cat.name}:`, error);
                }
            }
        }

        // Then create all other channels
        for (const channel of allChannels) {
            if (channel.type !== 'GUILD_CATEGORY') {
                const parentId = channel.parent ? categoryMap.get(channel.parent.id) : undefined;
                const newChannel = await copyChannel(channel, targetGuild, parentId, roleMapping);
                
                // Set position explicitly
                if (newChannel && 'position' in channel) {
                    try {
                        await newChannel.setPosition(channel.position);
                    } catch (error) {
                        console.warn(`Could not set position for channel ${channel.name}:`, error);
                    }
                }
            }
        }

        // Try to set the icon if available
        const iconURL = sourceGuild.iconURL();
        if (iconURL) {
            try {
                await targetGuild.setIcon(iconURL);
                console.log('Copied server icon');
            } catch (error) {
                console.warn('Could not set guild icon:', error);
            }
        }

        // Try to set the name
        try {
            await targetGuild.setName(sourceGuild.name);
            console.log('Set server name');
        } catch (error) {
            console.warn('Could not set guild name:', error);
        }

        console.log(`Copy completed successfully!`);

    } catch (error) {
        console.error('An error occurred:', error);
    }
}

async function copyChannel(channel: any, targetGuild: Guild, parentId: string | undefined, roleMapping: RoleMapping) {
    const permissionOverwrites: PermissionOverwriteData[] = [];
    
    // Map overwrites
    for (const [targetId, overwrite] of channel.permissionOverwrites.cache) {
        if (overwrite.type === 'role' && roleMapping[targetId]) {
            permissionOverwrites.push({
                id: roleMapping[targetId],
                type: 'role' as OverwriteType,
                allow: overwrite.allow,
                deny: overwrite.deny
            });
        } else if (overwrite.type === 'member' && targetId === client.user!.id) {
            permissionOverwrites.push({
                id: client.user!.id,
                type: 'member' as OverwriteType,
                allow: overwrite.allow,
                deny: overwrite.deny
            });
        }
    }

    // Create channel based on type
    if (channel instanceof TextChannel) {
        const newChannel = await targetGuild.channels.create(channel.name, {
            type: 'GUILD_TEXT',
            parent: parentId,
            topic: channel.topic || undefined,
            rateLimitPerUser: channel.rateLimitPerUser,
            nsfw: channel.nsfw,
            permissionOverwrites
        });
        console.log(`Created text channel: ${channel.name}`);
        return newChannel;
    } else if (channel instanceof VoiceChannel) {
        const channelData: any = {
            type: 'GUILD_VOICE',
            parent: parentId,
            bitrate: Math.min(channel.bitrate, 96000),
            userLimit: channel.userLimit,
            permissionOverwrites
        };
        if (channel.rtcRegion) {
            channelData.rtc_region = channel.rtcRegion;
        }
        const newChannel = await targetGuild.channels.create(channel.name, channelData);
        console.log(`Created voice channel: ${channel.name}`);
        return newChannel;
    }
    return null;
}

// Run the client
client.login(TOKEN);
