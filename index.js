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
    "👍": "1485734630228234286"
};

const CAPTCHA_ROLE_ID = "1485734630228234286"; // роль за капчу (можешь заменить)
const captchaChannels = new Map(); // guildId -> channelId

let reactionMessageId = null;

// ================== SLASH КОМАНДЫ ==================
const commands = [
    new SlashCommandBuilder().setName('brushon').setDescription('Включить капчу в канале'),
    new SlashCommandBuilder().setName('brushoff').setDescription('Выключить капчу в канале')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

client.once(Events.ClientReady, async () => {
    console.log(`✅ Запущен как ${client.user.tag}`);

    // регистрация команд
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log("✅ Slash-команды зарегистрированы");
    } catch (err) {
        console.error(err);
    }

    // сообщение с ролями (как у тебя)
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

// ================== КОМАНДЫ ==================
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // только владелец сервера
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

// ================== КАПЧА ==================
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;

    try {
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        const guild = reaction.message.guild;
        if (!guild) return;

        const captchaChannelId = captchaChannels.get(guild.id);

        // если это канал капчи
        if (captchaChannelId && reaction.message.channel.id === captchaChannelId) {
            if (reaction.emoji.name !== "👍") return;

            const member = await guild.members.fetch(user.id);

            const role = guild.roles.cache.get(CAPTCHA_ROLE_ID);
            if (!role) return;

            await member.roles.add(role);
            console.log(`🛡️ Капча пройдена: ${user.tag}`);
            return;
        }

        // ================== ТВОЯ СИСТЕМА РОЛЕЙ ==================
        if (reaction.message.id !== reactionMessageId) return;

        const roleId = roles[reaction.emoji.name];
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
