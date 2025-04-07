/**
 * /app/engine/interpretarMensagem.js
 */

const { Configuration, OpenAIApi } = require('openai');
const { loadTopics } = require('./loader');

// Configura API OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Carrega todas as ações definidas nos topics.json
const allActions = loadTopics(); 
// ex.: [
//   { intent: 'agendar_os_completo', arquivo: 'agendar_os_completo' },
//   { intent: 'buscar_cliente_por_cpf', arquivo: 'buscarClientePorCpf' },
//   ...
// ]

/**
 * interpretarMensagem(mensagem, contexto)
 * 
 * Retorna { intent, data, mensagem }
 */
async function interpretarMensagem(mensagem, contexto = {}) {
  // Montamos a lista de intents disponíveis para injetar no prompt
  // (somente os nomes, pois "arquivo" é interno)
  const availableIntents = allActions.map(a => a.intent);

  // Monta o prompt do "system"
  const systemPrompt = `
    Você é um assistente que ajuda o usuário a resolver assuntos relacionados a Ordens de Serviço (OS).
    A lista de intents disponíveis é:
    ${JSON.stringify(availableIntents)}

    Sempre responda em JSON no formato:
    {
      "intent": "...",
      "data": { ... },
      "mensagem": "..."
    }

    Onde:
    - "intent" DEVE ser um dos itens da lista acima, ou "desconhecido" se não houver correspondência.
    - "data" pode conter campos como "cpf", "osId", etc.
    - "mensagem" é o texto que enviaremos ao usuário.

    Contexto atual: ${JSON.stringify(contexto)}
  `;

  const completion = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: mensagem }
    ]
  });

  const gptOutput = completion.data.choices[0].message?.content?.trim() || '';

  let parsed;
  try {
    parsed = JSON.parse(gptOutput);
  } catch (err) {
    parsed = {
      intent: 'desconhecido',
      data: {},
      mensagem: 'Não entendi sua solicitação. Pode reformular por favor?'
    };
  }

  // Se "intent" não estiver na lista de availableIntents, forçamos 'desconhecido'
  if (!availableIntents.includes(parsed.intent)) {
    parsed.intent = 'desconhecido';
  }

  if (!parsed.data) {
    parsed.data = {};
  }
  if (!parsed.mensagem) {
    parsed.mensagem = '';
  }

  return parsed;
}

module.exports = { interpretarMensagem };
