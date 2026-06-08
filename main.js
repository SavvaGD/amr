const TelegramBot = require('node-telegram-bot-api');
const bamo = require('./bamo');
const moto = require('./moto');

const TOKEN = process.env.TELEGRAM_TOKEN || '8688529735:AAFrLF9vyImuCj4zHQkka-NWEgpj2gypipc';

const bot = new TelegramBot(TOKEN, { polling: true });

const chatModes = new Map();
const chatTopics = new Map();
const chatLocks = new Map();

async function isAdmin(chatId, userId) {
    try {
        const admins = await bot.getChatAdministrators(chatId);
        return admins.some(admin => admin.user.id === userId);
    } catch {
        return false;
    }
}

async function setChatMode(chatId, userId, mode, topic = null) {
    if (chatLocks.get(chatId)) {
        if (!await isAdmin(chatId, userId)) {
            bot.sendMessage(chatId, '❌ Режим заблокирован админом!');
            return false;
        }
    }
    
    chatModes.set(chatId, mode);
    if (mode === 'moto' && topic) {
        chatTopics.set(chatId, topic);
        bot.sendMessage(chatId, `✅ Тема: ${topic}`);
    } else if (mode === 'bamo') {
        chatTopics.delete(chatId);
        bot.sendMessage(chatId, '✅ Базовая модерация');
    } else if (mode === 'wimo') {
        chatTopics.delete(chatId);
        bot.sendMessage(chatId, '✅ Без модерации');
    }
    return true;
}

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text || '';
    
    if (text.startsWith('/')) {
        const command = text.split(' ')[0];
        
        // Новая команда /start
        if (command === '/start') {
            bot.sendMessage(chatId, `
🤖 *Бот-модератор*

*Команды:*
/wimo — Без модерации
/bamo — Базовая модерация
/moto [тема] — Модерация с ограниченными темами
/lomo — Заблокировать смену режима (админы)
/unlomo — Разблокировать смену режима (админы)

*Правила:*
1. Без мата
2. Без спама
3. Без рекламы
4. Без кибербуллинга

✅ Бот активен
`, { parse_mode: 'Markdown' });
            return;
        }
        
        if (command === '/wimo') await setChatMode(chatId, userId, 'wimo');
        else if (command === '/bamo') await setChatMode(chatId, userId, 'bamo');
        else if (command === '/moto') {
            const topic = text.slice(6).trim();
            if (!topic) return bot.sendMessage(chatId, '⚠️ /moto [тема]');
            await setChatMode(chatId, userId, 'moto', topic);
        }
        else if (command === '/lomo') {
            if (await isAdmin(chatId, userId)) {
                chatLocks.set(chatId, true);
                bot.sendMessage(chatId, '🔒 Режим заблокирован');
            } else bot.sendMessage(chatId, '⛔ Не админ');
        }
        else if (command === '/unlomo') {
            if (await isAdmin(chatId, userId)) {
                chatLocks.set(chatId, false);
                bot.sendMessage(chatId, '🔓 Режим разблокирован');
            } else bot.sendMessage(chatId, '⛔ Не админ');
        }
        return;
    }
    
    const mode = chatModes.get(chatId) || 'bamo';
    if (mode === 'wimo') return;
    
    const basicCheck = bamo.checkMessage(text);
    if (basicCheck.isViolation) {
        try {
            await bot.deleteMessage(chatId, msg.message_id);
            bot.sendMessage(chatId, `🚫 ${basicCheck.reason}`);
        } catch (err) {}
        return;
    }
    
    if (mode === 'moto') {
        const topic = chatTopics.get(chatId);
        const topicCheck = moto.checkTopic(text, topic);
        if (!topicCheck.isRelevant) {
            try {
                await bot.deleteMessage(chatId, msg.message_id);
                bot.sendMessage(chatId, `🚫 Не тема "${topic}"`);
            } catch (err) {}
        }
    }
});

bot.on('polling_error', (error) => {
    console.log('Ошибка:', error.message);
});

console.log('🤖 Бот-модератор запущен');