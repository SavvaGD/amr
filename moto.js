// Простая проверка соответствия теме (можно улучшить через ИИ или ключевые слова)
function checkTopic(text, topic) {
    const lowerText = text.toLowerCase();
    const lowerTopic = topic.toLowerCase();
    
    // Разбиваем тему на ключевые слова
    const keywords = lowerTopic.split(/\s+/);
    
    // Проверяем, есть ли хотя бы одно ключевое слово
    const hasKeyword = keywords.some(keyword => lowerText.includes(keyword));
    
    if (!hasKeyword) {
        return { 
            isRelevant: false, 
            suggestion: `Пожалуйста, пишите сообщения на тему "${topic}"` 
        };
    }
    
    return { isRelevant: true };
}

// Расширенная версия с запрещёнными темами (опционально)
const forbiddenTopics = ['политика', 'религия', '18+'];
function isForbiddenTopic(text) {
    const lower = text.toLowerCase();
    return forbiddenTopics.some(topic => lower.includes(topic));
}

module.exports = { checkTopic, isForbiddenTopic };