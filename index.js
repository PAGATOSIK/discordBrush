require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    Events,
    REST,
    Routes,
    SlashCommandBuilder
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

// ================== НАСТРОЙКИ ==================
const roles = {
    "👍": "1485734630228234286" // emoji => роль
};

const CAPTCHA_ROLE_ID = "1485734630228234286"; // роль капчи
const captchaChannels = new Map(); // guildId -> channelId
let reactionMessageId = null;

// Канал для уведомлений о пользователях без капчи
const NOTIFY_CHANNEL_ID = process.env.NOTIFY_CHANNEL_ID;

// ================== SLASH КОМАНДЫ ==================
const commands = [
    new SlashCommandBuilder().setName('brushon').setDescription('Включить капчу в канале'),
    new SlashCommandBuilder().setName('brushoff').setDescription('Выключить капчу в канале')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

// ================== READY ==================
client.once(Events.ClientReady, async () => {
    console.log(`✅ Запущен как ${client.user.tag}`);

    // регистрация slash-команд
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log("✅ Slash-команды зарегистрированы");
    } catch (err) {
        console.error(err);
    }

    // сообщение с ролями
    try {
        const channel = await client.channels.fetch(process.env.CHANNEL_ID);

        const message = await channel.send({
            content: "🎭 **Выбери роль:**\n\n👍 — Игрок"
        });

        reactionMessageId = message.id;

        for (const emoji of Object.keys(roles)) {
            await message.react(emoji);
        }

        console.log("✅ Сообщение с реакциями создано");
    } catch (err) {
        console.error("❌ Ошибка при отправке:", err);
    }

    // ================== Авто-оповещение каждые час ==================
    setInterval(() => {
        client.guilds.cache.forEach(guild => {
            notifyUnverifiedMembers(guild);
        });
    }, 60 * 60 * 1000); // 1 час
});

// ================== КОМАНДЫ ==================
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply({ content: "❌ Только создатель может использовать эту команду", ephemeral: true });
    }

    if (interaction.commandName === 'brushon') {
        captchaChannels.set(interaction.guild.id, interaction.channel.id);

        const msg = await interaction.reply({
            content: "🛡️ Капча включена!\nНажмите 👍 чтобы получить доступ",
            fetchReply: true
        });

        await msg.react("👍");
    }

    if (interaction.commandName === 'brushoff') {
        captchaChannels.delete(interaction.guild.id);
        interaction.reply("🛑 Капча отключена");
    }
});

// ================== ВСПОМОГАТЕЛЬНОЕ ==================
function getEmojiKey(reaction) {
    return reaction.emoji.id || reaction.emoji.name;
}

// ================== КАПЧА + РОЛИ ==================
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;

    try {
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        const guild = reaction.message.guild;
        if (!guild) return;

        const emojiKey = getEmojiKey(reaction);

        // ===== КАПЧА =====
        const captchaChannelId = captchaChannels.get(guild.id);

        if (captchaChannelId && reaction.message.channel.id === captchaChannelId) {
            if (reaction.emoji.name !== "👍") return;

            const member = await guild.members.fetch(user.id);
            const role = guild.roles.cache.get(CAPTCHA_ROLE_ID);

            if (!role) return;

            await member.roles.add(role);
            console.log(`🛡️ Капча пройдена: ${user.tag}`);
            return;
        }

        // ===== РОЛИ =====
        if (reaction.message.id !== reactionMessageId) return;

        const roleId = roles[emojiKey];
        if (!roleId) return;

        const member = await guild.members.fetch(user.id);
        await member.roles.add(roleId);

        console.log(`➕ Выдана роль ${roleId} пользователю ${user.tag}`);

    } catch (err) {
        console.error("❌ Ошибка add:", err);
    }
});

// ================== УДАЛЕНИЕ РОЛИ ==================
client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (user.bot) return;

    try {
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        if (reaction.message.id !== reactionMessageId) return;

        const emojiKey = getEmojiKey(reaction);
        const roleId = roles[emojiKey];
        if (!roleId) return;

        const member = await reaction.message.guild.members.fetch(user.id);
        await member.roles.remove(roleId);

        console.log(`➖ Убрана роль ${roleId} у ${user.tag}`);
    } catch (err) {
        console.error("❌ Ошибка remove:", err);
    }
});

// ================== УВЕДОМЛЕНИЕ НЕПРОЙШЕДШИХ КАПЧУ ==================
async function notifyUnverifiedMembers(guild) {
    try {
        const role = guild.roles.cache.get(CAPTCHA_ROLE_ID);
        if (!role) return;

        await guild.members.fetch();

        const members = guild.members.cache.filter(member => 
            !member.user.bot && !member.roles.cache.has(CAPTCHA_ROLE_ID)
        );

        if (members.size === 0) return;

        const channel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
        if (!channel) return;

        const mentions = members.map(m => `<@${m.id}>`).join(", ");

        await channel.send({
            content: `⏰ Пользователи, не прошедшие капчу:\n${mentions}`
        });

        console.log(`📢 Оповещено ${members.size} пользователей`);

    } catch (err) {
        console.error("❌ Ошибка notify:", err);
    }
}

client.login(process.env.TOKEN);
