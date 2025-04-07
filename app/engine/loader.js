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

module.exports = {
  loadAgent,
  loadTopic,
  loadActionFile
};
