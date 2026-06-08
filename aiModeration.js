const { pipeline } = require('@xenova/transformers');

let zeroShotClassifier = null;
let sentimentAnalyzer = null;

async function loadZeroShot() {
    if (!zeroShotClassifier) {
        console.log('🔄 Загрузка мультиязычной модели для темы...');
        zeroShotClassifier = await pipeline('zero-shot-classification', 'Xenova/multilingual-e5-small');
        console.log('✅ Модель для темы загружена');
    }
    return zeroShotClassifier;
}

async function loadSentiment() {
    if (!sentimentAnalyzer) {
        console.log('🔄 Загрузка русской модели для анализа тональности...');
        sentimentAnalyzer = await pipeline('sentiment-analysis', 'cointegrated/rubert-tiny2-rubert-tiny2-sentiment-balanced');
        console.log('✅ Русская модель тональности загружена');
    }
    return sentimentAnalyzer;
}

async function isAggressive(text) {
    try {
        const analyzer = await loadSentiment();
        const result = await analyzer(text.slice(0, 512));
        
        // Модель возвращает: label (positive/negative) и score
        // Для русского текста агрессия = negative с высоким score
        if (result[0].label === 'negative' && result[0].score > 0.7) {
            return true;
        }
        return false;
    } catch (err) {
        console.error('Ошибка анализа тональности:', err);
        // Fallback на ключевые слова
        const aggressiveWords = ['идиот', 'дурак', 'тупой', 'дебил', 'лох', 'сдохни', 'убейся', 'заткнись', 'тварь', 'сволочь'];
        const lowerText = text.toLowerCase();
        return aggressiveWords.some(word => lowerText.includes(word));
    }
}

async function isAdvertising(text) {
    const lowerText = text.toLowerCase();
    
    const adPatterns = [
        /https?:\/\/[^\s]+/i,
        /www\.[^\s]+/i,
        /@\w+/g,
        /\+?\d[\d\s\-\(\)]{8,}\d/,
        /скидка|акция|распродажа|купить|заказать|цена|рублей|💸|💰/i,
        /discount|sale|buy|order|price|cheap/i
    ];
    
    for (const pattern of adPatterns) {
        if (pattern.test(lowerText)) return true;
    }
    return false;
}

function isSpam(text) {
    if (text.length < 3) return true;
    if (/(.)\1{4,}/.test(text)) return true;
    if (/(\b\w+\b)\s+\1/.test(text)) return true;
    
    const upperCount = (text.match(/[A-ZА-Я]/g) || []).length;
    const totalLetters = (text.match(/[A-Za-zА-Яа-я]/g) || []).length;
    if (totalLetters > 10 && upperCount / totalLetters > 0.7) return true;
    
    return false;
}

async function checkMessageAI(text) {
    if (isSpam(text)) {
        return { 
            isViolation: true, 
            reason: 'Спам (повторяющиеся символы/слова или капс)', 
            severity: 'mute',
            confidence: 0.9
        };
    }
    
    if (await isAdvertising(text)) {
        return { 
            isViolation: true, 
            reason: 'Реклама (ссылки, контакты, призывы купить)', 
            severity: 'mute',
            confidence: 0.85
        };
    }
    
    // Проверка на агрессию через русскую нейросеть
    if (await isAggressive(text)) {
        return { 
            isViolation: true, 
            reason: 'Кибербуллинг/агрессия (обнаружено нейросетью)', 
            severity: 'warn',
            confidence: 0.8
        };
    }
    
    // Базовая проверка мата
    const badWords = ['хуй', 'пизда', 'бля', 'ебал', 'мудак', 'уебок', 'сука', 'редиска', 'гандон', 'шлюха', 'блять'];
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