const aiModeration = require('./aiModeration');

async function checkMessage(text) {
    // Используем нейросеть для проверки
    const result = await aiModeration.checkMessageAI(text);
    
    if (result.isViolation) {
        return result;
    }
    
    return { isViolation: false };
}

module.exports = { checkMessage };