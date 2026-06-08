const { pipeline } = require('@xenova/transformers');

let zeroShotClassifier = null;
let sentimentAnalyzer = null;

// Загрузка zero-shot классификатора (для тематики)
async function loadZeroShot() {
    if (!zeroShotClassifier) {
        console.log('🔄 Загрузка нейросети для анализа темы...');
        zeroShotClassifier = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-xsmall');
        console.log('✅ Нейросеть для темы загружена');
    }
    return zeroShotClassifier;
}

// Загрузка анализатора тональности (для определения агрессии/буллинга)
async function loadSentiment() {
    if (!sentimentAnalyzer) {
        console.log('🔄 Загрузка нейросети для анализа тональности...');
        sentimentAnalyzer = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
        console.log('✅ Нейросеть для тональности загружена');
    }
    return sentimentAnalyzer;
}

// Проверка на буллинг/агрессию через тональность
async function isAggressive(text) {
    try {
        const analyzer = await loadSentiment();
        // Для русского текста先用简单检测, для английского - нейросеть
        const isRussian = /[а-яА-Я]/.test(text);
        if (isRussian) {
            // Для русского - базовые правила + ключевые слова
            const aggressiveWords = ['идиот', 'дурак', 'тупой', 'дебил', 'лох', 'сдохни', 'убейся', 'заткнись', 'тварь', 'сволочь'];
            const lowerText = text.toLowerCase();
            return aggressiveWords.some(word => lowerText.includes(word));
        }
        
        // Для английского - нейросеть
        const result = await analyzer(text);
        return result[0].label === 'NEGATIVE' && result[0].score > 0.9;
    } catch (err) {
        console.error('Ошибка анализа тональности:', err);
        return false;
    }
}

// Определение рекламы
async function isAdvertising(text) {
    const lowerText = text.toLowerCase();
    
    // Признаки рекламы
    const adPatterns = [
        /https?:\/\/[^\s]+/i,           // ссылки
        /www\.[^\s]+/i,                 // www
        /@\w+/g,                        // упоминания
        /\+?\d[\d\s\-\(\)]{8,}\d/,      // телефоны
        /скидка|акция|распродажа|купить|заказать|цена|рублей|💸|💰/i,
        /discount|sale|buy|order|price|cheap/i
    ];
    
    for (const pattern of adPatterns) {
        if (pattern.test(lowerText)) return true;
    }
    
    return false;
}

// Определение спама
function isSpam(text) {
    if (text.length < 3) return true;
    if (/(.)\1{4,}/.test(text)) return true;           // ааааа
    if (/(\b\w+\b)\s+\1/.test(text)) return true;      // повтор слов
    
    // Капс (более 70% заглавных и длина > 10)
    const upperCount = (text.match(/[A-ZА-Я]/g) || []).length;
    const totalLetters = (text.match(/[A-Za-zА-Яа-я]/g) || []).length;
    if (totalLetters > 10 && upperCount / totalLetters > 0.7) return true;
    
    return false;
}

// Главная функция проверки сообщения
async function checkMessageAI(text) {
    // Проверка на спам (быстрая)
    if (isSpam(text)) {
        return { 
            isViolation: true, 
            reason: 'Спам (повторяющиеся символы/слова или капс)', 
            severity: 'mute',
            confidence: 0.9
        };
    }
    
    // Проверка на рекламу
    if (await isAdvertising(text)) {
        return { 
            isViolation: true, 
            reason: 'Реклама (ссылки, контакты, призывы купить)', 
            severity: 'mute',
            confidence: 0.85
        };
    }
    
    // Проверка на агрессию/буллинг (нейросеть)
    if (await isAggressive(text)) {
        return { 
            isViolation: true, 
            reason: 'Кибербуллинг/агрессия', 
            severity: 'warn',
            confidence: 0.8
        };
    }
    
    // Базовая проверка мата (для русского)
    const badWords = ['хуй', 'пизда', 'бля', 'ебал', 'мудак', 'уебок', 'сука', 'редиска'];
    const lowerText = text.toLowerCase();
    for (const word of badWords) {
        if (lowerText.includes(word)) {
            return {
                isViolation: true,
                reason: 'Нецензурная лексика',
                severity: 'warn',
                confidence: 0.95
            };
        }
    }
    
    return { isViolation: false };
}

module.exports = { checkMessageAI };