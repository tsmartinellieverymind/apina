
const { loadAgent } = require('../app/engine/loader');
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function interpretarMensagem(mensagem, agentId = 'default-agent') {
  const agent = loadAgent(agentId);
  const prompt = `
Você é ${agent.name}, um assistente com a seguinte função: ${agent.role}.
Seu objetivo é interpretar a intenção da mensagem recebida e responder sempre no seguinte formato JSON:

{
  "intent": "nome_da_intent",
  "data": { ... },
  "mensagem": "mensagem amigável para o usuário"
}

Algumas possíveis intents:
- "inicio": quando o usuário apenas iniciou o contato.
- "informar_cpf": quando ele estiver mandando o CPF.
- "verificar_os": quando ele quiser saber se tem OS em aberto.
- "escolher_os": quando ele mandar o número de uma OS.
- "agendar_data": quando informar uma data para agendamento.
- "finalizado": quando já terminou o processo.

Agora analise a mensagem abaixo:

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

  const respostaText = resposta.choices[0].message.content;

  try {
    return JSON.parse(respostaText);
  } catch (e) {
    console.error('❌ Erro ao parsear resposta da IA:', respostaText);
    return {
      intent: 'default',
      data: {},
      mensagem: 'Desculpa, não consegui entender o que você quis dizer.'
    };
  }
}

module.exports = { interpretarMensagem };




const { loadAgent } = require('../app/engine/loader');
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function interpretarMensagem(mensagem, agentId = 'default-agent') {
  const agent = loadAgent(agentId);

  const prompt = `
Você é ${agent.name}, com a função: ${agent.role}.
Sempre responda no formato JSON:
{
  "intent": "nome_da_action",
  "data": { ... },
  "mensagem": "mensagem para o usuário"
}
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

