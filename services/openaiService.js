require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const dayjs = require('dayjs');
const { loadAgent } = require('../app/engine/loader');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  /**
   * Observação:
   * - No "promptExtra", esperamos vir dados como:
   *   "O usuário se chama Fulano e gosta de alienígenas e futebol.
   *    Por favor, faça small talk sobre isso antes de retomar o assunto principal."
   * - Assim, o GPT terá esse contexto e poderá usar esses detalhes na resposta.
   */
  const prompt = `
Você é ${agent.nome}, um assistente focado em atender clientes de forma amigável e eficiente. Sua função: ${agent.role}.

Use este contexto adicional para estabelecer uma pequena conversa (small talk) sobre o que estiver descrito (nome, interesses etc.), mas sem fugir do seu objetivo principal de suporte.

Caso isso aconteça diga que está em horario de trabalho e não pode falar sobre isso, mas quem sabe depois?

Evite responder as frases com uma saudação do tipo Olá! Só fale caso tenha certeza que é a primeira interação do dia e a intent igual a "inicio"

Depois de fazer uma rápida menção a esse contexto (se existir), interprete a mensagem do usuário e retorne **APENAS** o JSON no seguinte formato:

{
  "intent": "nome_da_intent",
  "data": {},
  "mensagem": "resposta amigável ao usuário, incluindo um pouco do small talk"
}

Contexto anterior:
- Última intenção: "${intentAnterior}"
- Pergunta anterior: "${mensagemAnterior}"
- Nova mensagem do usuário: "${mensagem}"

*IMPORTANTE*
Se a "Pergunta anterior" tiver alguma saudação do tipo (Oi, Olá etc) e a intent anterior for diferente de inicial, não de nenhuma saudação.

### Dados adicionais (promptExtra) Utilize apenas o último inserido caso preciso, evite usar essas informações, só utilize se for perguntado.
Os topicos abaixo estão separados por quebra de linha, se a proxima resposta (Nova mensagem do usuário) não tiver relação/continuidade com a mensagem a (Pergunta anterior) você volta a pedir o CPF para iniciar o atendimento de agendamento.
${promptExtra}

### Intents possíveis


1) "inicio"  
   - Quando o usuário inicia ou saúda.
   - **Não** fazer saudação várias vezes na mesma conversa.
   - Exemplo de resposta (apenas uma vez): 
     {
       "intent": "inicio",
       "data": {},
       "mensagem": "Olá, sou ${agent.nome} da Ibiunet! Tudo bem? Poderia me enviar seu CPF para iniciarmos o atendimento?"
     }

2) "aleatorio"  
   - Se o usuário fala algo fora do fluxo ou fora do contexto (ex.: aliens, futebol, etc.).
   - Responda curto e tente puxar o assunto de volta para CPF, agendamento, OS etc.
   - Exemplo:
     {
       "intent": "aleatorio",
       "data": {},
       "mensagem": "Legal (Mostrar interesse sobre o que foi dito), mas primeiro eu vou precisar te identificar! Me mande seu CPF para a gente iniciar."
     }

3) "informar_cpf"  
   - O usuário está informando o CPF. Ex:(522.473.726-51 ; 52247372651) deve conter 11 digitos menos que nova a intent deve ser considerada escolher_os
   - Exemplo:
     {
       "intent": "informar_cpf",
       "data": {},
       "mensagem": "Ok, CPF recebido! Já vou verificar seus dados."
     }

4) "verificar_os"  
   - Ex.: "Quero consultar minha OS" ou "Que dia o técnico vem?" 
   - Exemplo:
     {
       "intent": "verificar_os",
       "data": {},
       "mensagem": "Certo, vou dar uma olhada nas suas OS. Só um instante."
     }

5) "escolher_os"  
   - O usuário escolhe ou informa qual OS quer editar/agendar. Pode vir apenas como um número sempre menor que 9 digitos. verificar 
   - Exemplo:
     {
       "intent": "escolher_os",
       "data": {},
       "mensagem": "Entendi, você escolheu a OS 1234. Agora podemos agendar ou atualizar."
     }

6) "agendar_data"  
   - O usuário pede explicitamente para agendar ou marcar visita.
   - Exemplo:
     {
       "intent": "agendar_data",
       "data": {},
       "mensagem": "Claro! Qual dia seria melhor para você?"
     }

7) "extrair_data"  
   - O usuário mencionou datas em linguagem natural (ex.: amanhã, sábado, dia 20).
   - Exemplo:
     {
       "intent": "extrair_data",
       "data": {},
       "mensagem": "Você mencionou essa data. Vou interpretá-la e confirmar."
     }

8) "confirmar_agendamento"  
   - O usuário confirma a data final que deseja.
   - Exemplo:
     {
       "intent": "confirmar_agendamento",
       "data": {},
       "mensagem": "Perfeito, confirmando sua visita. Qualquer mudança, me avise."
     }

9) "finalizado"
   - Fluxo concluído ou usuário se despediu.
   - Exemplo:
     {
       "intent": "finalizado",
       "data": {},
       "mensagem": "Ótimo, encerramos por aqui. Obrigado pelo contato e até mais!"
     }

10) "help"
   - O usuário pede ajuda ou não sabe como prosseguir.
   - Exemplo:
     {
       "intent": "help",
       "data": {},
       "mensagem": "Posso te ajudar a informar seu CPF, verificar ou agendar uma OS. O que gostaria?"
     }

11) "desconhecido"
   - Não foi possível classificar a mensagem.
   - Exemplo:
     {
       "intent": "desconhecido",
       "data": {},
       "mensagem": "Não entendi bem. Poderia tentar reformular ou explicar melhor?"
     }

12) "extrair_hora"  
   - O usuário mencionou datas em linguagem natural (ex.: amanhã, sábado, dia 20) e também horario ( 10 da manhã, final da tarde etc)
   - Exemplo:
     {
       "intent": "extrair_hora",
       "data": {},
       "mensagem": "Você mencionou essa data. Vou interpretá-la e confirmar."
     }

Importante: **retorne APENAS o JSON** (sem texto fora do objeto JSON). Se não tiver certeza, use "aleatorio" ou "desconhecido".
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

  //console.log('🔍 Agent carregado:', agent);

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

 console.error('### PROMPT INTENÇÃO ###:', prompt);

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

Retorne APENAS o JSON, sem mais nada.
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

async function interpretaDataeHora(mensagem) {
  const prompt = `
Você é um assistente que interpreta datas e horários em linguagem natural.

Seu objetivo é identificar tanto a data quanto o horário mencionados pelo usuário.

As respostas devem seguir este formato:
{
  "data_interpretada": "YYYY-MM-DD",
  "horario_interpretado": "HH:MM:SS"
}

Horários válidos:
- 08:00:00
- 10:00:00
- 13:00:00
- 15:00:00
- 17:00:00

Se a data ou o horário não puderem ser identificados, use null nos respectivos campos.

Mensagem do usuário: "${mensagem}"
Hoje é: ${dayjs().format('YYYY-MM-DD')}

Retorne APENAS o JSON acima, sem mais nada.
`;

  try {
    const openai = require('openai');
    const client = new openai.OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const resposta = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Você é um assistente que interpreta datas e horários informais.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    });

    const json = JSON.parse(resposta.choices[0].message.content);
    console.log('📅 Data e horário interpretados:', json);
    return json;
  } catch (error) {
    console.error('❌ Erro ao interpretar data e hora:', error);
    return {
      data_interpretada: null,
      horario_interpretado: null
    };
  }
}

async function interpretaHora(mensagem) {
  const prompt = `
Você é um assistente que interpreta horários em linguagem natural e retorna sempre no seguinte formato JSON:

{
  "hora_interpretada": "HH:mm:00"
}

Tente identificar o horário mencionado pelo usuário com base na frase. Caso não encontre nenhuma hora válida, responda:

{
  "hora_interpretada": null
}

Frase do usuário: "${mensagem}"

Retorne APENAS o JSON, sem mais nada.
`;

  try {
    const resposta = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Você é um assistente que interpreta horários informais.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    });

    const json = JSON.parse(resposta.choices[0].message.content);
    console.error('hora interpretada:', json.hora_interpretada);
    return json.hora_interpretada;
  } catch (error) {
    console.error('❌ Erro ao interpretar hora:', error);
    return null;
  }
}

module.exports = {
  interpretarMensagem,
  responderComBaseNaIntent,
  interpretarDataNatural,
  interpretaHora,
  interpretaDataeHora
};
