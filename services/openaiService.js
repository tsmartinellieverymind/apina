require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const dayjs = require('dayjs');
const { loadAgent } = require('../app/engine/loader');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Interpreta a mensagem do usuário para extrair a intenção (intent) e dados relevantes.
 * Recebe parâmetros como objeto nomeado para evitar problemas de ordem de parâmetros.
 * 
 * @param {Object} params
 * @param {string} params.mensagem - Mensagem do usuário
 * @param {string} [params.agentId='default-agent'] - ID do agente (carregado via loadAgent)
 * @param {string} [params.promptExtra=''] - Texto adicional que será concatenado ao prompt
 * @param {string} [params.intentAnterior=''] - Última intenção (contexto anterior)
 * @param {string} [params.mensagemAnterior=''] - Última mensagem enviada ao usuário (contexto anterior)
 * @returns {Promise<{ intent: string, data: object, mensagem: string }>}
 */
async function interpretarMensagem({
  mensagem,
  agentId = 'default-agent',
  promptExtra = '',
  intentAnterior = '',
  mensagemAnterior = ''
}) {
  if (!mensagem || typeof mensagem !== 'string') {
    console.error('❌ Mensagem inválida recebida para interpretação:', mensagem);
    return {
      intent: 'default',
      data: {},
      mensagem: 'Desculpa, não consegui entender o que você quis dizer. Pode tentar de novo?'
    };
  }

  const agent = loadAgent(agentId);

  const prompt = `
Você é ${agent.nome}, um assistente com a seguinte função: ${agent.role}.
Seu objetivo é interpretar a intenção da mensagem recebida e responder sempre no seguinte formato JSON:

{
  "intent": "nome_da_intent",
  "data": { ... },
  "mensagem": "mensagem amigável para o usuário"
}

Algumas possíveis intents:
- "inicio"
- "aleatorio"
- "informar_cpf"
- "verificar_os"
- "escolher_os"
- "agendar_data"
- "extrair_data"
- "finalizado"

Contexto anterior: A última intenção detectada foi "${intentAnterior}". Isso pode te ajudar a entender o que o usuário quis dizer com a nova mensagem.

Sua pergunta anterior ao usuário foi : ${mensagemAnterior}
E essa foi a mensagem do usuário: ${mensagem}

${promptExtra}
`;
  console.error('Interpretar intencao promptExtra:', prompt);

  try {
    const resposta = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: agent.personality },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    });

    const respostaText = resposta.choices[0].message.content;
    return JSON.parse(respostaText);

  } catch (error) {
    console.error('❌ Erro no OpenAI:', error);
    return {
      intent: 'default',
      data: {},
      mensagem: 'Desculpa, não entendi o que você quis dizer. Pode tentar de novo?'
    };
  }
}

/**
 * Gera uma resposta ao usuário com base numa intent conhecida.
 * Pode receber um texto extra (promptAuxiliar) para dar contexto adicional.
 * 
 * @param {string} intent
 * @param {string} [agentId='default-agent']
 * @param {Object} [dados={}]
 * @param {string} [promptAuxiliar='']
 * @returns {Promise<string>}
 */
async function responderComBaseNaIntent(intent, agentId = 'default-agent', dados = {}, promptAuxiliar = '') {
  const agent = loadAgent(agentId) || { nome: 'Assistente', role: 'ajudar o usuário de forma gentil e eficaz.' };

  console.log('🔍 Agent carregado:', agent);

  const prompt = `
Você é ${agent.nome}, um assistente que deve ajudar o usuário com base em uma intenção já conhecida.

Sua tarefa é gerar uma **mensagem clara e amigável** para o usuário com base na seguinte intenção detectada: "${intent}".

Use um tom informal e humano, como se estivesse conversando com o cliente. Aqui estão alguns dados adicionais que podem te ajudar: ${JSON.stringify(dados)} ${promptAuxiliar}

Exemplos:
- Se for "inicio", diga algo como: "Pode mandar seu CPF (com ou sem pontuação) pra eu conseguir te ajudar 🙂"
- Se for "informar_cpf", diga algo como: "Pode mandar seu CPF (com ou sem pontuação) pra eu conseguir te ajudar 🙂"
- Se for "verificar_os", diga algo como: "Agora vou dar uma olhadinha nas OS abertas pra vc 😉"
- Se for "agendar_data", diga algo como: "Qual dia seria melhor pra você agendar essa OS? Posso sugerir amanhã 👇"

Agora gere **somente** a mensagem para o usuário.
`;

  console.error('prompt:', prompt);
  try {
    const resposta = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: agent.personality },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5
    });

    return resposta.choices[0].message.content.trim();

  } catch (error) {
    console.error('❌ Erro ao gerar resposta por intent:', error);
    return 'Desculpa, tive um problema aqui. Tenta de novo rapidinho?';
  }
}

/**
 * Tenta interpretar uma data na mensagem do usuário (linguagem natural).
 * Retorna "YYYY-MM-DD" ou null caso não consiga identificar.
 * 
 * @param {string} mensagem 
 * @returns {Promise<string|null>}
 */
async function interpretarDataNatural(mensagem) {
  const prompt = `
Você é um assistente que interpreta datas em linguagem natural e retorna sempre no seguinte formato JSON:

{
  "data_interpretada": "YYYY-MM-DD"
}

Tente identificar a data mencionada pelo usuário com base na data atual. Caso não encontre nenhuma data válida, responda:

{
  "data_interpretada": null
}

Frase do usuário: "${mensagem}"
Hoje é: ${dayjs().format('YYYY-MM-DD')}
`;

  try {
    const resposta = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Você é um assistente que interpreta datas informais.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    });

    const json = JSON.parse(resposta.choices[0].message.content);
    console.error('data interpretada:', json.data_interpretada);
    return json.data_interpretada;
  } catch (error) {
    console.error('❌ Erro ao interpretar data:', error);
    return null;
  }
}

module.exports = {
  interpretarMensagem,
  responderComBaseNaIntent,
  interpretarDataNatural
};
