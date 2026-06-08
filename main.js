const TelegramBot = require('node-telegram-bot-api');
const bamo = require('./bamo');
const moto = require('./moto');

const TOKEN = process.env.TELEGRAM_TOKEN;

const bot = new TelegramBot(TOKEN, { 
    polling: true,
    baseApiUrl: 'https://api.telegram.org.kg'
});

// Хранилища
const chatModes = new Map();
const chatTopics = new Map();
const chatLocks = new Map();
const userWarnings = new Map();   // key: `${chatId}_${userId}` -> { count, lastWarnTime }
const userMutes = new Map();      // key: `${chatId}_${userId}` -> until timestamp

// Предупреждения и мут
async function warnUser(chatId, userId, firstName, reason) {
    const key = `${chatId}_${userId}`;
    const now = Date.now();
    
    if (!userWarnings.has(key)) {
        userWarnings.set(key, { count: 1, lastWarnTime: now });
    } else {
        const warning = userWarnings.get(key);
        
        // Если прошло больше часа, сбрасываем счётчик
        if (now - warning.lastWarnTime > 60 * 60 * 1000) {
            userWarnings.set(key, { count: 1, lastWarnTime: now });
        } else {
            warning.count++;
            warning.lastWarnTime = now;
            userWarnings.set(key, warning);
            
            // 3 предупреждения = мут 5 минут
            if (warning.count >= 3) {
                await muteUser(chatId, userId, firstName, 5);
                userWarnings.delete(key);
                bot.sendMessage(chatId, `⚠️ ${firstName} получил МУТ на 5 минут (3 предупреждения)`);
                return;
            }
        }
    }
    
    const warningCount = userWarnings.get(key).count;
    bot.sendMessage(chatId, `⚠️ ${firstName}, предупреждение ${warningCount}/3\nПричина: ${reason}`);
}

async function muteUser(chatId, userId, firstName, minutes) {
    const until = Date.now() + (minutes * 60 * 1000);
    const key = `${chatId}_${userId}`;
    userMutes.set(key, until);
    
    bot.sendMessage(chatId, `🔇 ${firstName} получил мут на ${minutes} минут`);
    
    setTimeout(async () => {
        if (userMutes.get(key) === until) {
            userMutes.delete(key);
            bot.sendMessage(chatId, `🔓 ${firstName} размучен`);
        }
    }, minutes * 60 * 1000);
}

function isMuted(chatId, userId) {
    const until = userMutes.get(`${chatId}_${userId}`);
    if (until && until > Date.now()) return true;
    if (until) userMutes.delete(`${chatId}_${userId}`);
    return false;
}

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
            bot.sendMessage(chatId, '❌ Режим заблокирован администратором!');
            return false;
        }
    }
    
    chatModes.set(chatId, mode);
    if (mode === 'moto' && topic) {
        chatTopics.set(chatId, topic);
        moto.clearHistory(chatId);
        bot.sendMessage(chatId, `✅ Режим: ТЕМАТИЧЕСКАЯ МОДЕРАЦИЯ\n📌 Тема: ${topic}\n🧠 Нейросеть анализирует контекст (последние 10 сообщений)`);
    } else if (mode === 'bamo') {
        chatTopics.delete(chatId);
        moto.clearHistory(chatId);
        bot.sendMessage(chatId, `✅ Режим: БАЗОВАЯ МОДЕРАЦИЯ\n🧠 Нейросеть проверяет:\n• Нецензурную лексику\n• Спам и капс\n• Рекламу\n• Кибербуллинг`);
    } else if (mode === 'wimo') {
        chatTopics.delete(chatId);
        moto.clearHistory(chatId);
        bot.sendMessage(chatId, '✅ Режим: БЕЗ МОДЕРАЦИИ');
    }
    return true;
}

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name || 'Пользователь';
    const text = msg.text || '';
    
    // Проверка на мут
    if (isMuted(chatId, userId)) {
        try {
            await bot.deleteMessage(chatId, msg.message_id);
        } catch (err) {}
        return;
    }
    
    // Сохраняем в историю (для moto)
    if (text && !text.startsWith('/')) {
        moto.addToHistory(chatId, userId, text);
    }
    
    // Обработка команд
    if (text.startsWith('/')) {
        const command = text.split(' ')[0];
        
        if (command === '/start') {
            bot.sendMessage(chatId, `
🤖 *Бот-модератор с нейросетями*

*Команды:*
/wimo — Без модерации
/bamo — Базовая модерация (ИИ)
/moto [тема] — Тематическая модерация (ИИ + контекст)
/lomo — Заблокировать смену режима (админы)
/unlomo — Разблокировать смену режима (админы)

*Правила (bamo):*
1️⃣ Нецензурная лексика → предупреждение
2️⃣ Спам/капс → мут 1 минута
3️⃣ Реклама → мут 1 минута
4️⃣ Кибербуллинг → предупреждение

*Наказания:*
⚠️ 3 предупреждения = мут 5 минут
🔇 Во время мута нельзя писать

*Особенности:*
🧠 Нейросеть понимает смысл сообщений
📝 В режиме /moto учитывается контекст (10 последних сообщений)

✅ Бот активен
`, { parse_mode: 'Markdown' });
            return;
        }
        
        if (command === '/wimo') await setChatMode(chatId, userId, 'wimo');
        else if (command === '/bamo') await setChatMode(chatId, userId, 'bamo');
        else if (command === '/moto') {
            const topic = text.slice(6).trim();
            if (!topic) return bot.sendMessage(chatId, '⚠️ Укажите тему: /moto [тема]\nПример: /moto программирование');
            await setChatMode(chatId, userId, 'moto', topic);
        }
        else if (command === '/lomo') {
            if (await isAdmin(chatId, userId)) {
                chatLocks.set(chatId, true);
                bot.sendMessage(chatId, '🔒 Смена режима ЗАБЛОКИРОВАНА');
            } else bot.sendMessage(chatId, '⛔ Только для администраторов');
        }
        else if (command === '/unlomo') {
            if (await isAdmin(chatId, userId)) {
                chatLocks.set(chatId, false);
                bot.sendMessage(chatId, '🔓 Смена режима РАЗБЛОКИРОВАНА');
            } else bot.sendMessage(chatId, '⛔ Только для администраторов');
        }
        return;
    }
    
    // Модерация
    const mode = chatModes.get(chatId) || 'bamo';
    if (mode === 'wimo') return;
    
    if (mode === 'bamo') {
        // Базовая модерация с нейросетью
        const result = await bamo.checkMessage(text);
        if (result.isViolation) {
            try {
                await bot.deleteMessage(chatId, msg.message_id);
                
                if (result.severity === 'warn') {
                    await warnUser(chatId, userId, firstName, result.reason);
                } else if (result.severity === 'mute') {
                    await muteUser(chatId, userId, firstName, 1);
                    bot.sendMessage(chatId, `🔇 ${firstName}, мут 1 минута: ${result.reason}`);
                }
            } catch (err) {
                console.log('Ошибка удаления:', err.message);
            }
        }
        return;
    }
    
    if (mode === 'moto') {
        const topic = chatTopics.get(chatId);
        if (!topic) return;
        
        // Тематическая модерация с нейросетью
        const topicCheck = await moto.checkTopic(text, topic, chatId);
        
        if (!topicCheck.isRelevant) {
            try {
                await bot.deleteMessage(chatId, msg.message_id);
                await warnUser(chatId, userId, firstName, `Несоответствие теме "${topic}" (уверенность ${topicCheck.confidence})`);
                bot.sendMessage(chatId, `🚫 ${firstName}, сообщение не соответствует теме "${topic}"\n🧠 Нейросеть: ${topicCheck.reason}`);
            } catch (err) {}
        }
        return;
    }
});

bot.on('polling_error', (error) => {
    console.log('Polling error:', error.message);
});

console.log('🤖 Бот-модератор с нейросетями запущен');
console.log('🧠 Модели загружаются при первом использовании (10-20 секунд)');