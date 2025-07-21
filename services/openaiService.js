require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const dayjs = require('dayjs');
const { loadAgent } = require('../app/engine/loader');
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { INTENTS, getIntentByCodigo } = require('../app/models/IntentModel');

function logPrompt(title, body = '') {
  console.log(
    `\n====== ${title.toUpperCase()} ======\n` +
    (typeof body === 'string'
      ? body.replace(/\\n/g, '\n').replace(/\\"/g, '"')
      : JSON.stringify(body, null, 2)
    ) +
    '\n===============================\n'
  );
}

function gerarTodasAsIntentsPrompt() {
  return INTENTS.map(i => {
    const p = i.gerarPrompt();
    return `// ${i.nome}
      intent: "${p.intent}"
      descrição: ${p.descricao}`;
  }).join('\n\n');
}

async function gerarMensagemDaIntent({
  intent,
  agentId = 'agent_os',
  dados = {},
  promptExtra = ''
}) {
  const agent = loadAgent(agentId);
  const intentData = INTENTS.find(i => i.codigo === intent);

  const sugestoesDeRespostas = intentData?.responses?.length
    ? `Alguns exemplos de como você pode responder:\n${intentData.responses.map(r => `- ${r}`).join('\n')}`
    : '';

  const prompt = `
Você é ${agent.nome}, sua função é ${agent.role}. Você tem a seguinte personalidade: ${agent.personality}

${intent === 'aleatorio' 
  ? 'Faça um small talk com a mensagem recebida (veja em "Contexto extra") e retome o assunto anterior.' 
  : `Sua missão é ajudar o usuário com base na intenção atual: "${intent}".`}

Contexto principal: ${JSON.stringify(dados)}
Contexto extra: ${promptExtra}

${sugestoesDeRespostas}

Retorne SOMENTE a mensagem final para o usuário (sem JSON).
`;

  logPrompt('prompt Mensagem:', prompt);

  try {
    const resposta = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: agent.personality },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    });

    return resposta.choices[0].message.content.trim();
  } catch (error) {
    logPrompt('❌ Erro ao gerar resposta da intent:', error);
    return 'Desculpa, não consegui processar isso agora. Pode repetir?';
  }
}

/**
 * Detecta a nova intenção do usuário com base na conversa anterior.
 */
async function detectarIntentComContexto({
  mensagem,
  agentId = 'agent_os',
  promptExtra = '',
  intentAnterior = '',
  mensagemAnterior = '',
  tipoUltimaPergunta = ''  
}) {
  const agent = loadAgent(agentId);
  const blocoDeIntents = gerarTodasAsIntentsPrompt();

  const prompt = `
Você é ${agent.nome}, um assistente da Ibiunet.
Sua função é analisar a mensagem do cliente e detectar qual a intenção dele, com base nas opções disponíveis abaixo.

### Regras Fixas (em ordem de prioridade):
1. Se identificar 11 números seguidos → **extrair_cpf**.
2. Se mencionar "CPF" mas sem número → **aleatorio**.
3. Se disser "primeira", "segunda", "terceira" → **escolher_os**.
4. Se o usuário mencionar um dia da semana específico (segunda, terça, quarta, etc.) ou uma data (amanhã, dia 10, próxima semana) → **extrair_data**, mesmo que use frases como "pode ser" ou "prefiro".
5. Se o usuário mencionar um período do dia (manhã, tarde) ou horário específico → **extrair_hora**, mesmo que use frases como "pode ser" ou "prefiro".
6. Se disser "ok", "pode ser", "fechado" ou similares SEM mencionar uma data ou período específico:
   - Se a ÚLTIMA PERGUNTA foi sobre **agendamento**, e a resposta é de aceitação → **confirmar_agendamento**.
   - Se foi sobre **escolha de OS**, e a resposta é de aceitação → **confirmar_escolha_os**.
7. Se o usuário pedir para **sugerir horário**, **escolher outro horário**, ou **sugerir/listar opções** → **agendar_data**.
8. Se o usuário **perguntar sobre disponibilidade** de uma data/horário específico (ex: "tem para dia X?", "está disponível dia X?") → **consultar_disponibilidade_data**.

### Exemplos de Classificação Correta:
- "pode ser" (sem mencionar data/hora) → **confirmar_agendamento**
- "pode ser terça?" → **extrair_data**
- "prefiro pela manhã" → **extrair_hora**
- "essa data está boa, mas prefiro de tarde" → **alterar_periodo**
- "tem disponibilidade na sexta?" → **consultar_disponibilidade_data**
- "quero ver outras opções" → **datas_disponiveis**

### Contexto da conversa:
- Última intent detectada: ${intentAnterior}
- Última pergunta feita ao cliente: "${mensagemAnterior}"
- Tipo da última pergunta: "${tipoUltimaPergunta}"
- Nova mensagem do cliente: "${mensagem}"

Resumo adicional:
${promptExtra}

### Intents disponíveis:
${blocoDeIntents}

Retorne APENAS o JSON:
{ "intent": "nome_da_intent" }
`;

  logPrompt('prompt Intent', prompt);

  try {
    const resposta = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: agent.personality },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    });

    return JSON.parse(resposta.choices[0].message.content);
  } catch (error) {
    logPrompt('❌ Erro ao detectar intent:', error);
    return { intent: 'aleatorio' };
  }
}

/**
 * Gera uma resposta com base nos filhos da intent atual.
 */
async function gerarMensagemDaIntent({
  intent,
  agentId = 'agent_os',
  dados = {},
  promptExtra = ''
}) {
  const agent = loadAgent(agentId);

  const prompt = `
Você é ${agent.nome}, sua função é ${agent.role} sua personalidade é  ${agent.personality} 

${intent === 'aleatorio' ? 'Faça um small talk com a mensagem recebida (nova mensagem enviada dentro de Contexto Extra) do usuário e retome o assunto' : 'Sua missão é ajudar o usuário com base na intenção atual:'+ intent}

${intent !== 'inicio' ? '*NÃO* repita saudações (Olá/Oi/Boa …) se já houver saudado nas mensagens anteriores.' : 'Sua missão é ajudar o usuário com base na intenção atual:'+ intent}

Contexto PRINCIPAL: ${JSON.stringify(dados)}
Contexto extra: ${promptExtra}

Retorne SOMENTE a mensagem final para o usuário (sem JSON).
`;



// Baseie-se APENAS nas seguintes possibilidades de resposta (intents filhas do fluxo atual):

// ${filhosPrompt}

logPrompt('prompt Mensagem:', prompt);
  try {
    const resposta = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: agent.personality },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    });

    return resposta.choices[0].message.content.trim();
  } catch (error) {
    logPrompt('❌ Erro ao gerar resposta da intent:', error);
    return 'Desculpa, não consegui processar isso agora. Pode repetir?';
  }
}

/**
 * Gera uma resposta ao usuário com base numa intent conhecida.
 * Pode receber um texto extra (promptAuxiliar) para dar contexto adicional.
 *
 * @param {string} intent
 * @param {string} [agentId='agent_os']
 * @param {Object} [dados={}]
 * @param {string} [promptAuxiliar='']
 * @returns {Promise<string>}
 */
async function responderComBaseNaIntent(intent, agentId = 'agent_os', dados = {}, promptAuxiliar = '') {
  const agent = loadAgent(agentId) || { nome: 'Assistente', role: 'ajudar o usuário de forma gentil e eficaz.' };

  //logPrompt('🔍 Agent carregado:', agent);

  const prompt = `
Você é ${agent.nome}, um assistente que deve ajudar o usuário com base na intenção: "${intent}".
Sua função: ${agent.role}.
Use tom informal e amigável, como conversando com o cliente.

Dados adicionais: ${JSON.stringify(dados)}
Contexto extra: ${promptAuxiliar}

Exemplos de resposta:
- "inicio": "Olá! Como posso te ajudar? Se quiser, mande seu CPF."
- "aleatorio": Essa intent pode variar muito mas tente fazer com que o usuario responta a pergunta anterior que era " ${JSON.stringify(dados.mensagemAnteriorCliente)}
- "help": "Posso te ajudar a informar seu CPF ou a marcar seu agendamento, é só pedir."
- "os_nao_encontrada": 

Retorne SOMENTE a frase (sem JSON).
`;

 logPrompt('### PROMPT INTENÇÃO ###:', prompt);

  try {
    const resposta = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: agent.personality },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5
    });

    return resposta.choices[0].message.content.trim();

  } catch (error) {
    logPrompt('❌ Erro ao gerar resposta por intent:', error);
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
async function interpretarDataNatural(mensagem, agentId = 'agent_os', dados = {}, promptExtra = '') {
  const agent = require('../app/engine/loader').loadAgent(agentId);
  
  // Verificar se o promptExtra solicita período também
  const solicitaPeriodo = promptExtra.includes('período') || promptExtra.includes('periodo') || promptExtra.includes('manhã') || promptExtra.includes('tarde');
  
  const prompt = `
"${agent.nome}", sua função é ${agent.role}. Você tem a seguinte personalidade: ${agent.personality}

Você é um assistente que interpreta datas em linguagem natural e retorna sempre no seguinte formato JSON:
Você deve encontrar o valor da variavel "data_interpretada".

{
  "data_interpretada": "YYYY-MM-DD",
  "periodo": "M" ou "T"
}
**Manha = M
**Tarde = T

Frase do usuário: "${mensagem}"
Hoje é: ${dayjs().format('YYYY-MM-DD')}

Contexto principal: ${JSON.stringify(dados)}
Contexto extra: ${promptExtra}
    
Retorne APENAS o JSON, sem mais nada.
`;
console.log('====== PROMPT INTERPRETA DATA NATURAL ======');
console.log(prompt);
console.log('==========================================');
  try {
    const resposta = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: agent.personality },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    });

    const json = JSON.parse(resposta.choices[0].message.content);
    logPrompt('data interpretada:', json);
    
    // Se o promptExtra solicita período, retornar o objeto completo
    if (solicitaPeriodo) {
      return json;
    }
    
    // Caso contrário, retornar apenas a data para manter compatibilidade
    return json.data_interpretada;
  } catch (error) {
    logPrompt('❌ Erro ao interpretar data:', error);
    return null;
  }
}

async function interpretaDataePeriodo({ mensagem, agentId = 'agent_os', dados = {}, promptExtra = '' }) {
  const agent = require('../app/engine/loader').loadAgent(agentId);
  const dataAtual = dayjs().format('YYYY-MM-DD');

  const prompt = `
Você é um especialista em extrair datas e períodos (manhã/tarde) de textos em português.

Sua tarefa é analisar a "Frase do usuário" e retornar um objeto JSON com "data_interpretada" (no formato YYYY-MM-DD) e "periodo_interpretado" ("M" para manhã, "T" para tarde).

Regras:
1.  **Data de Referência**: Hoje é ${dataAtual}. Use esta data para calcular datas relativas como "hoje", "amanhã", "próxima segunda-feira".
2.  **Extração**: Extraia a data e o período mesmo que a frase seja uma pergunta ou contenha palavras extras (ex: "pode ser", "acho que", "talvez").
3.  **Formato de Saída**: Retorne SEMPRE um objeto JSON. Se não encontrar uma data ou período, use o valor null. Não inclua explicações.

Exemplos:
- Frase: "Pode ser hoje?"
  Hoje: ${dataAtual}
  Resposta JSON: { "data_interpretada": "${dataAtual}", "periodo_interpretado": null }

- Frase: "amanhã de tarde"
  Hoje: ${dataAtual}
  Resposta JSON: { "data_interpretada": "${dayjs().add(1, 'day').format('YYYY-MM-DD')}", "periodo_interpretado": "T" }

- Frase: "quero marcar para o dia 25"
  Hoje: ${dataAtual}
  Resposta JSON: { "data_interpretada": "${dayjs().format('YYYY-MM')}-25", "periodo_interpretado": null }

- Frase: "na parte da manhã"
  Hoje: ${dataAtual}
  Resposta JSON: { "data_interpretada": null, "periodo_interpretado": "M" }

- Frase: "blz"
  Hoje: ${dataAtual}
  Resposta JSON: { "data_interpretada": null, "periodo_interpretado": null }

---
Contexto da conversa (pode ajudar a definir data ou período se não estiver explícito na frase):
${JSON.stringify(dados)}
${promptExtra}
---

Frase do usuário: "${mensagem}"
Hoje é: ${dataAtual}

Retorne APENAS o JSON.
`;

  logPrompt('PROMPT PARA INTERPRETAR DATA E PERÍODO', prompt);

  try {
    const resposta = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Modelo mais moderno
      messages: [{ role: 'system', content: 'Você é um especialista em extrair datas e períodos de textos.' }, { role: 'user', content: prompt }],
      temperature: 0.0, // Temperatura baixa para ser mais determinístico
      response_format: { type: "json_object" },
    });

    const jsonString = resposta.choices[0].message.content;
    logPrompt('RESPOSTA JSON DA DATA', jsonString);
    const json = JSON.parse(jsonString);
    
    // Validação básica do retorno
    if (json && typeof json.data_interpretada !== 'undefined' && typeof json.periodo_interpretado !== 'undefined') {
        return json;
    } else {
        console.error('Erro: JSON retornado pela IA não tem o formato esperado.', jsonString);
        return { data_interpretada: null, periodo_interpretado: null };
    }

  } catch (error) {
    console.error('Erro ao interpretar data e período com a IA:', error);
    return {
      data_interpretada: null,
      periodo_interpretado: null
    };
  }
}

async function interpretarNumeroOS({ mensagem, osList = [], agentId = '', dados = {}, promptExtra = '' }) {
  /* --------  monta lista reduzida  -------- */
  const listaReduzida = osList
    .map((o, i) => `${i + 1}) ${o.id} - ${o.titulo || o.mensagem || 'Sem descrição'}`)
    .join('\n');

  let contextoExtra = '';
  if (dados && Object.keys(dados).length > 0) {
    contextoExtra += `\nDados adicionais: ${JSON.stringify(dados)}`;
  }
  if (promptExtra) {
    contextoExtra += `\nContexto extra: ${promptExtra}`;
  }

  const prompt = `
Você é um assistente que identifica qual Ordem de Serviço (OS) o usuário quer.

### Lista de OS abertas
${listaReduzida}

### Contexto
${contextoExtra}

### Como o usuário pode se referir a uma OS
- Pelo **número** da OS (ex.: "12310")
- Pela **posição na lista** (ex.: "Quero a primeira", "pego a 2ª", "a terceira")

### Regras de interpretação
1. Se o usuário usar posição ("primeira", "1", "1ª"), mapeie para o ID que está nessa posição na lista.
2. Se digitar um número que **não está** na lista, retorne null.
3. Ignore palavras irrelevantes (ex.: “quero”, “a”, “pegar”).
4. Somente números de até 9 dígitos são considerados ID de OS.

### Formato de resposta (APENAS JSON)
Exemplo sucesso:  { "os": "12310" }
Exemplo falha:    { "os": null }

Frase do usuário: "${mensagem}"
`;

  logPrompt('prompt encontra os', prompt);

  try {
    const resposta = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `Você é um assistente que interpreta seleção de OS.${agentId ? ' Agente: ' + agentId : ''}` },
        { role: 'user',   content: prompt }
      ],
      temperature: 0.1
    });

    const json = JSON.parse(resposta.choices[0].message.content || '{}');
    logPrompt('os interpretada:', json.os);

    /* -------------- devolve o ID (ou null) -------------- */
    return json.os ?? null;

  } catch (error) {
    logPrompt('❌ Erro ao interpretar OS:', error);
    return null;
  }
}

async function interpretarEscolhaOS({ mensagem, osList = [], agentId = '', dados = {}, promptExtra = '' }) {
  const lista = osList.map((o, i) => `${i + 1}) ${o.id} - ${o.titulo || o.mensagem || 'Sem descrição'}`).join('\n');

  let contextoExtra = '';
  if (dados && Object.keys(dados).length > 0) {
    contextoExtra += `\nContexto do usuário: ${JSON.stringify(dados)}`;
  }
  if (promptExtra) {
    contextoExtra += `\nObservação: ${promptExtra}`;
  }

  const prompt = `
Você é um assistente que ajuda o cliente a escolher uma Ordem de Serviço (OS).

### Lista de OS disponíveis:
${lista}
${contextoExtra}

### Instruções:
- O cliente pode falar de maneira livre: ("quero a primeira", "prefiro o segundo", "vou querer a 3ª", "primeiro serve", etc).
- Seu trabalho é interpretar qual posição ele quis (1, 2, 3...).
- Se identificar claramente, responda o índice em JSON:
  { "posicao": 1 }
- Se não identificar, retorne:
  { "posicao": null }

Frase do cliente:
"${mensagem}"

Responda APENAS o JSON pedido.
`;

  const resposta = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `Você é um assistente de atendimento.${agentId ? ' Agente: ' + agentId : ''}` },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1
  });

  const json = JSON.parse(resposta.choices[0].message.content);
  return json.posicao ?? null;
}


/**
 * Busca o setor correspondente ao bairro e tipo de serviço
 * @param {string} bairro - Nome do bairro
 * @param {Array} listaBairros - Lista de bairros com seus respectivos IDs de setores
 * @param {string} tipo - Tipo de serviço ('instalacao' ou 'manutencao')
 * @returns {string|null} - ID do setor ou null se não encontrado
 */
async function buscarSetorPorBairro(bairro, listaBairros, tipo, agentId = 'agent_os') {

  if (!bairro || !listaBairros || !tipo) {
    return null;
  }

  // Tenta encontrar o objeto do bairro na lista
  const bairroObj = listaBairros.find(b => b.bairro && b.bairro.trim().toLowerCase() === bairro.trim().toLowerCase());
  if (!bairroObj || typeof bairroObj.setores !== 'object' || bairroObj.setores === null) {
    if (process.env.NODE_ENV !== 'production') {
      let exemplos = Array.isArray(listaBairros) ? listaBairros.slice(0, 3).map(b => b.bairro) : listaBairros;
      console.warn(`[DEBUG][buscarSetorPorBairro] Bairro não encontrado ou setores inválido:`, {
        bairro, tipo, bairroObj: JSON.stringify(bairroObj),
        listaBairrosResumo: {
          total: Array.isArray(listaBairros) ? listaBairros.length : 'N/A',
          exemplos
        }
      });
    }
    return null;
  }
  if (typeof bairroObj.setores[tipo] === 'undefined' || bairroObj.setores[tipo] === null) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[DEBUG][buscarSetorPorBairro] Tipo de setor não encontrado:`, {
        bairro, tipo, setores: JSON.stringify(bairroObj.setores)
      });
    }
    return null;
  }
  // Continua o fluxo normal (prompt OpenAI etc)

  if (!bairro || !listaBairros || !tipo) {
    return null;
  }

  const { loadAgent } = require('../app/engine/loader');
  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const agent = loadAgent(agentId);

  // Monta a lista de setores para o prompt
  const setoresPrompt = listaBairros.map(s => `ID: ${s.ids[tipo] || 'N/A'} | Nome: ${s.nome || '-'} | Bairro: ${s.bairro}`).join('\n');

  const prompt = `
Você é ${agent.nome}, sua função é analisar uma lista de setores e identificar a qual ID de setor pertence um bairro informado pelo usuário.

Contexto:
- Você receberá uma lista de setores, cada um com seu id, nome e bairro atendido.
- O usuário informará um bairro e o tipo de serviço desejado ('instalacao' ou 'manutencao').
- Sua tarefa é encontrar o setor correspondente ao bairro informado, considerando o tipo de serviço.
- Se não houver correspondência exata, escolha o setor mais próximo (por similaridade de nome de bairro).
- Retorne apenas o ID do setor correspondente (apenas o valor do id, sem explicações ou texto extra).

Lista de setores:
${setoresPrompt}

Bairro informado: "${bairro}"
Tipo de serviço: "${tipo}"

IMPORTANTE: Responda apenas com o ID do setor correspondente. Se não encontrar, responda "null".
`;

  console.log('[buscarSetorPorBairro][PROMPT ENVIADO AO OPENAI]:', prompt);

  try {
    const resposta = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: agent.personality },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 20
    });
    const content = resposta.choices[0].message.content.trim();
    console.log('[buscarSetorPorBairro][RESPOSTA OPENAI]:', content);
    // Retorna apenas o id se for um número ou string, senão null
    if (content.toLowerCase() === 'null') return null;
    return content;
  } catch (error) {
    console.error('[buscarSetorPorBairro][ERRO OPENAI]:', error.message);
    return null;
  }
}

// Busca o setor correspondente ao bairro e tipo de serviço usando apenas OpenAI
// @param {string} bairro - Nome do bairro
// @param {string} tipoServico - Tipo de serviço ('instalacao' ou 'manutencao')
// @param {Array} listaBairros - Lista de bairros com seus respectivos IDs de setores (opcional)
// @returns {Promise<Object>} - JSON estruturado {sucesso_busca, bairro, id, tipo}
async function findSetorByBairro(bairro, tipoServico, listaBairros = []) {
  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let prompt = `
  Você deve encontrar, na lista abaixo, o bairro cujo nome é mais parecido com o bairro "${bairro}". Siga rigorosamente estas regras:
  
  - O tipo de serviço é obrigatoriamente "${tipoServico}".
  - Encontre APENAS dentre os bairros da lista fornecida.
  - Retorne APENAS valores presentes nesta lista, sem nenhuma alteração.
  - O campo "id" retornado DEVE ser o valor do campo "${tipoServico}" do bairro encontrado.
  - Se não houver um bairro semelhante, retorne "sucesso_busca": false.
  
  Retorne exclusivamente um JSON no formato:
  
  {
    "sucesso_busca": <true ou false>,
    "bairro": "<bairro encontrado ou string vazia>",
    "id": "<valor do campo '${tipoServico}' do bairro encontrado ou string vazia>",
    "tipo": "${tipoServico}"
  }
  
  Lista de bairros disponíveis:
  
  ${listaBairros.map(b => `{
    "bairro": "${b.bairro}",
    "instalacao": ${b.instalacao},
    "manutencao": ${b.manutencao}
  }`).join(',\n')}
  
  Se nenhum bairro similar existir, retorne exatamente:
  
  {
    "sucesso_busca": false,
    "bairro": "",
    "id": "",
    "tipo": "${tipoServico}"
  }
  `;
  

  //console.log('[findSetorByBairro][PROMPT ENVIADO AO OPENAI]:', prompt);

  try {
    const completion = await openai.chat.completions.create({
      //model: 'gpt-4o-mini',
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é um assistente que responde apenas com JSON válido.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 150
    });

    let resposta = completion.choices[0].message.content.trim();
    resposta = resposta
      .replace(/^```json[\s\r\n]*/i, '')
      .replace(/^```[\s\r\n]*/i, '')
      .replace(/```$/g, '')
      .trim();

    try {
      return JSON.parse(resposta);
    } catch (e) {
      console.error('[findSetorByBairro][ERRO PARSE JSON]:', e, resposta);
      return { sucesso_busca: false, bairro: '', id: '', tipo: tipoServico };
    }

  } catch (openaiError) {
    console.error('[findSetorByBairro][ERRO AO CHAMAR OPENAI]:', openaiError);
    return { sucesso_busca: false, bairro: '', id: '', tipo: tipoServico };
  }
}


module.exports = {
  responderComBaseNaIntent,
  interpretarDataNatural,
  interpretaDataePeriodo,
  interpretarNumeroOS,
  interpretarEscolhaOS,
  detectarIntentComContexto,
  gerarMensagemDaIntent,
  buscarSetorPorBairro,
  findSetorByBairro
};
