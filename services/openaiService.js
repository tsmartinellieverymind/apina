const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function interpretarMensagem(mensagem, agent) {
  const prompt = `
Você é ${agent.name}, com função: ${agent.role}.
Sempre responda no formato:
{
  "intent": "nome_da_action",
  "data": { ... },
  "mensagem": "mensagem para o usuário"
}
---
Usuário: ${mensagem}
`;

  const resposta = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: agent.personality },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2
  });

  return JSON.parse(resposta.choices[0].message.content);
}

module.exports = { interpretarMensagem };
