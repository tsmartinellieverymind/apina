const { loadAgent, loadTopic, loadActionFile } = require('./loader');

async function execute(agentId, intent, params = {}) {
  const agent = loadAgent(agentId);

  for (const topicId of agent.topics) {
    const topic = loadTopic(topicId);
    const actionMeta = topic.actions.find(a => a.intent === intent);
    if (actionMeta) {
      const actionFn = loadActionFile(actionMeta.arquivo);
      return await actionFn(params);
    }
  }

  return { mensagem: 'Desculpe, não entendi o que você deseja fazer.' };
}

module.exports = { execute };
