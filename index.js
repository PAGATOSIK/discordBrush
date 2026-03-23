require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    Events 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

// ⚙️ настройки ролей (emoji -> role ID)
const roles = {
    "👍": "ROLE_ID_1",
    "🎮": "ROLE_ID_2",
    "🔥": "ROLE_ID_3"
};

// сюда запишется ID сообщения
let reactionMessageId = null;

client.once(Events.ClientReady, async () => {
    console.log(`✅ Запущен как ${client.user.tag}`);

    try {
        const channel = await client.channels.fetch(process.env.CHANNEL_ID);

        const message = await channel.send({
            content: "🎭 **Выбери роль:**\n\n👍 — Игрок\n🎮 — Геймер\n🔥 — Актив"
        });

        reactionMessageId = message.id;

        for (const emoji of Object.keys(roles)) {
            await message.react(emoji);
        }

        console.log("✅ Сообщение с реакциями создано");
    } catch (err) {
        console.error("❌ Ошибка при отправке:", err);
    }
});

// ➕ добавление роли
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;

    try {
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        if (reaction.message.id !== reactionMessageId) return;

        const roleId = roles[reaction.emoji.name];
        if (!roleId) return;

        const member = await reaction.message.guild.members.fetch(user.id);
        await member.roles.add(roleId);

        console.log(`➕ Выдана роль ${roleId} пользователю ${user.tag}`);
    } catch (err) {
        console.error("❌ Ошибка add:", err);
    }
});

// ➖ удаление роли
client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (user.bot) return;

    try {
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        if (reaction.message.id !== reactionMessageId) return;

        const roleId = roles[reaction.emoji.name];
        if (!roleId) return;

        const member = await reaction.message.guild.members.fetch(user.id);
        await member.roles.remove(roleId);

        console.log(`➖ Убрана роль ${roleId} у ${user.tag}`);
    } catch (err) {
        console.error("❌ Ошибка remove:", err);
    }
});

client.login(process.env.TOKEN);
