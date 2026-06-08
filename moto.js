const aiTopic = require('./aiTopic');

const chatHistory = new Map();

function addToHistory(chatId, userId, text) {
    if (!chatHistory.has(chatId)) {
        chatHistory.set(chatId, []);
    }
    const history = chatHistory.get(chatId);
    history.push({ userId, text, timestamp: Date.now() });
    
    while (history.length > 20) history.shift();
}

function getHistoryContext(chatId) {
    const history = chatHistory.get(chatId) || [];
    return history.slice(-10).map(msg => msg.text);
}

function clearHistory(chatId) {
    chatHistory.delete(chatId);
}

async function checkTopic(text, topic, chatId) {
    const history = getHistoryContext(chatId);
    const result = await aiTopic.isRelatedToTopic(text, topic, history);
    return result;
}

module.exports = { checkTopic, addToHistory, clearHistory, getHistoryContext };