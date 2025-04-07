const fs = require('fs');
const path = require('path');

function loadAgent(agentId = 'agent_os') {
  const filePath = path.join(__dirname, `../agents/${agentId}.json`);
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

function loadTopic(topicId) {
  const filePath = path.join(__dirname, `../topics/${topicId}.json`);
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

function loadActionFile(fileName) {
  return require(path.join(__dirname, `../actions/${fileName}.js`));
}

/**
 * Lê todos os arquivos .json dentro de /topics e retorna um array
 * com o conteúdo de cada tópico.
 */
function loadAllTopics() {
  const topicsDir = path.join(__dirname, '../topics');
  const files = fs.readdirSync(topicsDir);
  const topics = [];

  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(topicsDir, file);
      const data = fs.readFileSync(filePath, 'utf-8');
      const jsonData = JSON.parse(data);
      topics.push(jsonData);
    }
  }

  return topics; 
}

module.exports = {
  loadAgent,
  loadTopic,
  loadActionFile,
  loadAllTopics
};
