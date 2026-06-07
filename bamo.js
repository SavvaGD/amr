// Проверка мата
const badWords = ['дурак', 'идиот', 'редиска', 'bitch', 'fuck']; // добавьте свои
function hasProfanity(text) {
    const lower = text.toLowerCase();
    return badWords.some(word => lower.includes(word));
}

// Проверка спама (сообщения короче 3 символов или повтор символов)
function isSpam(text) {
    if (text.length < 3) return true;
    // Повтор одного символа 5+ раз (например "ааааа")
    if (/(.)\1{4,}/.test(text)) return true;
    // Повтор одинаковых слов подряд
    if (/(\b\w+\b)\s+\1/.test(text)) return true;
    return false;
}

// Проверка рекламы (ссылки, @username, номера телефонов)
function isAdvertising(text) {
    // Ссылки
    if (/https?:\/\/[^\s]+/i.test(text)) return true;
    if (/www\.[^\s]+/i.test(text)) return true;
    // Упоминания
    if (/@\w+/g.test(text)) return true;
    // Номера телефонов
    if (/\+?\d[\d\s\-\(\)]{8,}\d/.test(text)) return true;
    return false;
}

// Проверка кибербуллинга
function isBullying(text) {
    const lower = text.toLowerCase();
    const bullyingPhrases = [
        'ты тупой', 'иди в жопу', 'заткнись', 'убей себя',
        'ты ничтожество', 'сдохни', 'лох'
    ];
    return bullyingPhrases.some(phrase => lower.includes(phrase));
}

function checkMessage(text) {
    if (hasProfanity(text)) {
        return { isViolation: true, reason: 'Нецензурная лексика (правило 1)' };
    }
    if (isSpam(text)) {
        return { isViolation: true, reason: 'Спам (правило 2)' };
    }
    if (isAdvertising(text)) {
        return { isViolation: true, reason: 'Реклама (правило 3)' };
    }
    if (isBullying(text)) {
        return { isViolation: true, reason: 'Кибербуллинг (правило 4)' };
    }
    return { isViolation: false };
}

module.exports = { checkMessage };