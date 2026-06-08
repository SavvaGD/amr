const { pipeline } = require('@xenova/transformers');

let zeroShotClassifier = null;

async function loadClassifier() {
    if (!zeroShotClassifier) {
        console.log('🔄 Загрузка нейросети для тематической модерации...');
        zeroShotClassifier = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-xsmall');
        console.log('✅ Нейросеть для тем загружена');
    }
    return zeroShotClassifier;
}

async function isRelatedToTopic(text, topic, history = []) {
    try {
        const model = await loadClassifier();
        
        // Формируем контекст (сообщение + история)
        const context = [...history, text].join(' ').slice(0, 1000);
        
        // Zero-shot классификация
        const result = await model(context, [topic], {
            hypothesis_template: "Это сообщение относится к теме: {}."
        });
        
        const confidence = result.scores[0];
        const isRelevant = confidence > 0.55; // порог 55%
        
        return {
            isRelevant: isRelevant,
            confidence: confidence,
            reason: isRelevant ? `✅ (${Math.round(confidence * 100)}%)` : `❌ (${Math.round(confidence * 100)}%)`
        };
    } catch (err) {
        console.error('Ошибка нейросети темы:', err);
        // Fallback на ключевые слова
        const keywords = topic.toLowerCase().split(' ');
        const hasKeyword = keywords.some(kw => text.toLowerCase().includes(kw));
        return {
            isRelevant: hasKeyword,
            confidence: hasKeyword ? 0.7 : 0.3,
            reason: hasKeyword ? 'ключевые слова' : 'не найдено'
        };
    }
}

module.exports = { isRelatedToTopic };