const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
require('dayjs/locale/pt-br');
dayjs.locale('pt-br');
const { diaDaSemanaExtenso } = require('../app/utils/dateHelpers');
const { logEstado } = require('../app/utils/logger');


/* ---------------------------------------------------------
   Configurações
--------------------------------------------------------- */
const boolSalvarConversa = false; // toggle para gravar no MongoDB
const responderComAudio = process.env.RESPONDER_COM_AUDIO === 'true'; // true para responder com áudio, false para texto


/* ---------------------------------------------------------
   Serviços externos
--------------------------------------------------------- */
const { enviarMensagemWhatsApp } = require('../services/twillioService');
const { gerarAudioUrl } = require('../services/elevenLabsService'); 
const { baixarAudioTwilio, transcreverAudioWhisper } = require('../services/transcribeService');
const {
  buscarClientePorCpf,
  buscarOSPorClienteId,
  atualizarOS,
  gerarSugestoesDeAgendamento,
  verificarDisponibilidadeData,
  buscarDescricoesAssuntos,
  enriquecerOSComDescricoes,
  // verificarDisponibilidade
} = require('../services/ixcService');
const {
  refatorarResposta,
  detectarIntentComContexto,
  gerarMensagemDaIntent,
  interpretarDataNatural,
  interpretarNumeroOS,
  interpretarEscolhaOS,
  verificaTipoListagem,
} = require('../services/openaiService');

/* ---------------------------------------------------------
   Função adaptadora para substituir interpretaDataePeriodo
--------------------------------------------------------- */
async function interpretaDataePeriodo({ mensagem, agentId = 'agent_os', dados = {}, promptExtra = '' }) {
  try {
    // Tenta extrair a data e o período usando o serviço da OpenAI em uma única chamada
    const openAIResult = await interpretarDataNatural(
      mensagem,
      agentId,
      dados,
      promptExtra + ' Identifique a data e o período (manhã ou tarde) na frase do usuário: "' + mensagem + '". Responda APENAS com a data no formato YYYY-MM-DD e o período como "M" para manhã ou "T" para tarde, separados por vírgula. Exemplo: "2024-07-25,M". Se não identificar um período específico, use "T" como padrão para o período APENAS SE UMA DATA FOR IDENTIFICADA.'
    );

    console.log('====== RESULTADO interpretarDataNatural (data e período): ======');
    console.log(openAIResult);
    console.log('============================================================');

    let dataFinal = null;
    let periodoFinal = null;

    if (openAIResult && typeof openAIResult === 'object') {
      // Caso retorne objeto completo (nova estrutura)
      if (openAIResult.data_interpretada && dayjs(openAIResult.data_interpretada).isValid()) {
        dataFinal = openAIResult.data_interpretada;
      }
      if (openAIResult.periodo && ['M', 'T'].includes(openAIResult.periodo.toUpperCase())) {
        periodoFinal = openAIResult.periodo.toUpperCase();
      }
    } else if (openAIResult && typeof openAIResult === 'string') {
      const parts = openAIResult.split(',');
      if (parts.length > 0 && dayjs(parts[0].trim()).isValid()) {
        dataFinal = parts[0].trim();
      }
      if (parts.length > 1 && ['M', 'T'].includes(parts[1].trim().toUpperCase())) {
        periodoFinal = parts[1].trim().toUpperCase();
      }
    }


    // Se a OpenAI não retornou um período válido (M ou T), mas retornou uma data,
    // tentar usar a função local `interpretaPeriodo` como fallback.
    if (dataFinal && (!periodoFinal || !['M', 'T'].includes(periodoFinal))) {
      console.log('OpenAI não retornou período válido, tentando interpretaPeriodo localmente.');
      const periodoLocal = await interpretaPeriodo(mensagem);
      if (periodoLocal) {
        console.log('Período local encontrado:', periodoLocal);
        periodoFinal = periodoLocal;
      } else if (!periodoFinal && dataFinal) { // Se NENHUM período foi encontrado (nem OpenAI, nem local) E temos data
        console.log('Nenhum período específico encontrado, usando "T" (tarde) como padrão pois uma data foi identificada.');
        periodoFinal = 'T'; // Default para tarde se NENHUM período foi encontrado e temos data
      }
    }

    // Se ainda não temos data, mas temos período (cenário menos comum),
    // ou se não temos data de forma alguma, retorna null para indicar falha na extração completa.
    if (!dataFinal) {
      console.log('Nenhuma data válida foi interpretada.');
      return { data_interpretada: null, periodo_interpretado: periodoFinal }; // Retorna período se houver, mesmo sem data
    }

    // Retorna objeto com data e período
    return {
      data_interpretada: dataFinal,
      periodo_interpretado: periodoFinal
    };

  } catch (error) {
    console.error('Erro ao interpretar data e período:', error);
    return { data_interpretada: null, periodo_interpretado: null };
  }
}

/* ---------------------------------------------------------
   Função utilitária para validar se user.osEscolhida existe
--------------------------------------------------------- */
function validarOSEscolhida(user, respostaObj, mensagemPersonalizada = null) {
  if (!user.osEscolhida) {
    respostaObj.resposta = mensagemPersonalizada || gerarMensagemOSNaoSelecionada(user);
    return false;
  }
  return true;
}

/* ---------------------------------------------------------
   Função para interpretar o período (manhã/tarde) da mensagem
--------------------------------------------------------- */
async function interpretaPeriodo(mensagem) {
  try {
    if (!mensagem) return null;
    
    // Converter para minúsculas e remover acentos para facilitar a comparação
    const msgLower = mensagem.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    
    // Palavras-chave para identificar período da manhã
    const keywordsManha = [
      'manha', 'manhã', 'matutino', 'cedo', 'antes do almoco', 'antes do almoço',
      'antes do meio dia', 'am', 'a.m', 'a.m.', 'de manha', 'pela manha', 'pela manhã',
      '08h', '09h', '10h', '11h', '8h', '9h', '10h', '11h', '8:00', '9:00', '10:00', '11:00',
      '8 horas', '9 horas', '10 horas', '11 horas',
      'oito horas', 'nove horas', 'dez horas', 'onze horas'
    ];
    
    // Palavras-chave para identificar período da tarde
    const keywordsTarde = [
      'tarde', 'vespertino', 'depois do almoco', 'depois do almoço', 
      'depois do meio dia', 'pm', 'p.m', 'p.m.', 'de tarde', 'pela tarde',
      '13h', '14h', '15h', '16h', '17h', '18h', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
      '1h', '2h', '3h', '4h', '5h', '6h', '1:00', '2:00', '3:00', '4:00', '5:00', '6:00', // Adicionado 1h-6h para tarde
      '13 horas', '14 horas', '15 horas', '16 horas', '17 horas', '18 horas',
      '1 hora', '2 horas', '3 horas', '4 horas', '5 horas', '6 horas', // Adicionado "X hora(s)" para tarde
      'uma hora', 'duas horas', 'tres horas', 'quatro horas', 'cinco horas', 'seis horas' // Adicionado por extenso para tarde
    ];
    
    // Verificar se a mensagem contém palavras-chave de manhã
    for (const keyword of keywordsManha) {
      if (msgLower.includes(keyword)) {
        console.log(`Período da manhã identificado pela palavra-chave local: ${keyword}`);
        return 'M';
      }
    }
    
    // Verificar se a mensagem contém palavras-chave de tarde
    for (const keyword of keywordsTarde) {
      if (msgLower.includes(keyword)) {
        console.log(`Período da tarde identificado pela palavra-chave local: ${keyword}`);
        return 'T';
      }
    }
    
    // Se não encontrou nenhum período específico, retorna null
    console.log('Nenhum período específico identificado localmente.');
    return null;
  } catch (error) {
    console.error('Erro ao interpretar período localmente:', error);
    return null;
  }
}

async function verificaClienteIdOuPedeCPF(user, contexto, intent) {
  console.log("================== intent ==================")  
  console.log("==================" + intent + "=============================")
  console.log("================== intent ==================")

  console.log("================== user ==================")  
  console.log("==================" + user + "=============================")
  console.log("================== user ==================")

  console.log("================== clienteId ==================")  
  console.log("==================" + user.clienteId + "=============================")
  console.log("================== clienteId ==================")

  console.log("================== clienteId ==================")  
  console.log("==================" + !user.clienteId + "=============================")
  console.log("================== clienteId ==================")
  if (!user.clienteId) {

    return false;
  }
  return true;
}

/**
 * Verifica se o usuário tem um clienteId e, se não tiver, define uma resposta apropriada.
 * Retorna true se o clienteId estiver presente, false caso contrário.
 * @param {Object} user - Objeto do usuário
 * @param {Object} respostaObj - Objeto com getter/setter para a resposta
 * @returns {boolean} - true se o clienteId estiver presente, false caso contrário
 */
async function ensureClienteId(user, respostaObj) {
  if (!user.clienteId) {
    // Se não temos o clienteId, precisamos pedir o CPF
    respostaObj.resposta = 'Por favor, me informe seu CPF para que eu possa identificar suas ordens de serviço.';
    // user.etapaAtual = 'pedir_cpf';
    user.tipoUltimaPergunta = 'CPF';
    return false;
  }
  return true;
}

/**
 * Trata casos onde não há sugestões de agendamento disponíveis.
 * Verifica se o usuário tem outras OSs e oferece alternativas ou mensagem adequada.
 * @param {Object} user - Objeto do usuário
 * @returns {string} - Mensagem de resposta apropriada
 */
function tratarIndisponibilidadeAgendamento(user) {
  // Verificar se o usuário tem outras OSs abertas disponíveis para agendamento
  const outrasOSs = user.osList ? user.osList.filter(os => os.id !== user.osEscolhida.id && os.status === 'A') : [];
  
  if (outrasOSs.length > 0) {
    // Limpar a OS atual e oferecer outras opções
    const osAtualId = user.osEscolhida.id;
    user.osEscolhida = null;
    user.dataInterpretada = null;
    user.periodoAgendamento = null;
    user.sugestaoData = null;
    user.sugestaoPeriodo = null;
    
    const listaOutrasOS = outrasOSs.map(os => {
      const descricao = formatarDescricaoOS(os);
      return `• ${os.id} - ${descricao}`;
    }).join('\n');
    
    return `No momento não temos técnicos disponíveis para agendar a OS ${osAtualId}. ` +
           `Porém, você tem outras opções disponíveis:\n\n${listaOutrasOS}\n\n` +
           `Gostaria de agendar uma dessas outras OSs?`;
  } else {
    return 'No momento não temos técnicos disponíveis para agendar sua visita. Por favor, tente mais tarde.';
  }
}

const usuarios = {}; // { [numeroWhatsapp]: userState }

const extrairCpf = (texto = '') => {
  // Remove todos os caracteres não numéricos para análise
  const apenasNumeros = texto.replace(/[^\d]/g, '');
  
  // CPF deve ter exatamente 11 dígitos
  if (apenasNumeros.length !== 11) return null;
  
  // Verifica se os dígitos não são todos iguais (validação básica)
  if (/^(\d)\1{10}$/.test(apenasNumeros)) return null;
  
  // Validação adicional: verifica se parece com um CPF real
  // CPFs válidos não começam com 000, 111, 222, etc.
  const primeirosTres = apenasNumeros.substring(0, 3);
  if (/^(\d)\1{2}$/.test(primeirosTres)) {
    // Se os 3 primeiros dígitos são iguais, pode ser um CPF inválido
    // Mas vamos permitir para não ser muito restritivo
  }
  
  return apenasNumeros;
};

const gerarPromptContextualizado = dados => {
  const l = [];

  if (dados.nome) l.push(`O usuário se chama ${dados.nome}.`);
  if (dados.cpf) l.push(`O CPF informado é ${dados.cpf}.`);

  /* ---------- 1) Lista resumida das OS abertas ---------- */
  if (Array.isArray(dados.osList) && dados.osList.length) {
    const resumo = dados.osList
      .map(o => `• ${o.id} - ${o.descricaoAssunto || o.titulo || o.mensagem || 'Sem descrição'}`)
      .join(' / ');
    l.push(`OS abertas: ${resumo}.`);
  }

  /* ---------- 2) Detalhe da OS escolhida ---------- */
  if (dados.osEscolhida?.id) {
    const { id, titulo, mensagem, status } = dados.osEscolhida;
    l.push(
      `OS escolhida → ID ${id}` +
      (titulo ? ` | título: ${titulo}` : '') +
      (mensagem ? ` | desc.: ${mensagem}` : '') +
      (status ? ` | status: ${status}` : '')
    );
  }

  /* ---------- 3) Dados de sugestão de agendamento ---------- */
  if (dados.sugestaoData) {
    l.push(`Data sugerida para agendamento: ${dados.sugestaoData}.`);
  }
  if (dados.sugestaoPeriodo) {
    l.push(`Período sugerido para agendamento: ${dados.sugestaoPeriodo === 'M' ? 'manhã' : 'tarde'}.`);
  }

  /* ---------- 4) Resto dos campos ---------- */
  if (dados.etapaAnterior) l.push(`A etapa anterior foi "${dados.etapaAnterior}".`);
  if (dados.mensagemAnteriorGPT) l.push(`Mensagem anterior: "${dados.mensagemAnteriorGPT}".`);
  if (dados.mensagemAnteriorCliente) l.push(`Última mensagem do cliente: "${dados.mensagemAnteriorCliente}".`);
  if (dados.mensagemAtualCliente) l.push(`Nova mensagem do cliente: "${dados.mensagemAtualCliente}".`);
  if (dados.observacao) l.push(`Observação adicional: ${dados.observacao}.`);

  return l.join('\n');
};

const geraDados = (user, mensagemAtual, observacao = '') => ({
  intentAnterior: user.etapaAnterior,
  mensagemAnteriorGPT: user.mensagemAnteriorGPT,
  mensagemAnteriorCliente: user.mensagemAnteriorCliente,
  mensagemAtualCliente: mensagemAtual,
  etapaAnterior: user.etapaAnterior,
  cpf: user.cpf,
  sugestaoData: user.sugestaoData,
  sugestaoPeriodo: user.sugestaoPeriodo, // <- adiciona a sugestão de período também
  clienteId: user.clienteId,
  nome: user.nomeCliente,
  osList: user.osList,
  osEscolhida: user.osEscolhida,
  dataInterpretada: user.dataInterpretada,
  periodoAgendamento: user.periodoAgendamento,
  aguardandoConfirmacao: user.aguardandoConfirmacao,
  tipoUltimaPergunta: user.tipoUltimaPergunta,
  etapaAtual: user.etapaAtual,
  observacao
});

/**
 * Processa a escolha de uma OS com base na mensagem do usuário
 * @param {Object} params - Parâmetros da função
 * @param {string} params.mensagem - Mensagem do usuário
 * @param {Object} params.contexto - Contexto da conversa
 * @param {string} params.intent - Intent atual
 * @param {Array} params.osList - Lista de OS disponíveis
 * @returns {Object} - { osObj: Object, resposta: string }
 */
async function processarEscolhaOS({ mensagem, contexto, intent, osList }) {
  if (!osList || osList.length === 0) {
    return { resposta: 'Não há ordens de serviço disponíveis para agendamento.' };
  }

  try {
    // Tenta extrair o número da OS da mensagem
    const osPattern = /\b(\d{4,6})\b/; // Padrão para encontrar números de 4-6 dígitos (formato típico de OS)
    const osMatch = mensagem.match(osPattern);
    if (osMatch) {
      const osIdExtraido = osMatch[1];
      // Verificar se a OS existe na lista
      const osEncontrada = osList.find(os => os.id === osIdExtraido);
      if (osEncontrada) {
        return { osObj: osEncontrada };
      }
    }
    
    // Se não encontrou pelo número, tenta interpretar o ID da OS via IA
    const listaAtiva = (contexto && Array.isArray(contexto.ultimaListaOS) && contexto.ultimaListaOS.length)
      ? contexto.ultimaListaOS
      : osList;

    const osIdInterpretado = await interpretarEscolhaOS({
      mensagem,
      osList: listaAtiva,
      agentId: 'agent_os',
      dados: contexto,
      promptExtra: 'interprete e retorne o número exato da OS (osNr) dentre a lista apresentada.'
    });

    if (osIdInterpretado) {
      const escolhida = listaAtiva.find(o => String(o.id) === String(osIdInterpretado));
      if (escolhida) {
        return { osObj: escolhida };
      }
      // Como fallback, tenta no conjunto completo
      const escolhidaCompleta = osList.find(o => String(o.id) === String(osIdInterpretado));
      if (escolhidaCompleta) {
        return { osObj: escolhidaCompleta };
      }
    }
    
    // Se não conseguiu identificar, retorna mensagem solicitando escolha
    return { 
      resposta: 'Não consegui identificar qual OS você deseja. Por favor, informe o número da OS que deseja agendar.'
    };
  } catch (error) {
    console.error('Erro ao processar escolha de OS:', error);
    return { 
      resposta: 'Ocorreu um erro ao tentar identificar a OS. Por favor, informe o número da OS que deseja agendar.'
    };
  }
}


/**
 * Gera uma mensagem informando ao usuário que não há OS selecionada e lista as OS disponíveis
 * @param {Object} user - Objeto do usuário contendo informações das OS
 * @param {string} [mensagemPersonalizada] - Mensagem personalizada opcional para substituir a mensagem padrão
 * @returns {string} - Mensagem formatada com as OS disponíveis
 */
function gerarMensagemOSNaoSelecionada(user, mensagemPersonalizada = null) {
  let msg = mensagemPersonalizada || 'Ops! Parece que ainda não selecionamos uma OS. Pode me dizer qual é?';
  
  if (user.osList && user.osList.length > 0) {
    const abertas = user.osList.filter(os => os.status === 'A');
    const agendadas = user.osList.filter(os => os.status === 'AG');
    
    // Construir mensagem mais natural
    let detalhesOS = [];
    
    // OSs abertas
    if (abertas.length > 0) {
      if (abertas.length === 1) {
        detalhesOS.push(`Você tem 1 OS aberta: ${abertas[0].id} (${formatarDescricaoOS(abertas[0])})`);
      } else {
        const listaAbertas = abertas.map(os => `${os.id} (${formatarDescricaoOS(os)})`).join(', ');
        detalhesOS.push(`Você tem ${abertas.length} OSs abertas: ${listaAbertas}`);
      }
    }
    
    // OSs agendadas
    if (agendadas.length > 0) {
      agendadas.forEach(os => {
        const dataFormatada = os.data_agenda_final && os.data_agenda_final !== '0000-00-00 00:00:00' 
          ? dayjs(os.data_agenda_final).format('DD/MM/YYYY')
          : 'data não informada';
        
        if (agendadas.length === 1) {
          detalhesOS.push(`E você também tem a OS ${os.id} (${formatarDescricaoOS(os)}) já agendada para o dia ${dataFormatada}`);
        } else {
          // Se houver múltiplas agendadas, listar individualmente
          const prefixo = detalhesOS.length > 0 ? 'Também tem' : 'Você tem';
          detalhesOS.push(`${prefixo} a OS ${os.id} (${formatarDescricaoOS(os)}) agendada para ${dataFormatada}`);
        }
      });
    }
    
    if (detalhesOS.length > 0) {
      msg += '\n\n' + detalhesOS.join('.\n\n') + '.';
      msg += '\n\nPara qual delas você gostaria de atendimento? É só me dizer o número da OS! 😊';
    }
  }
  
  return msg;
}

/* ---------------------------------------------------------
   Rota principal – Webhook Twilio
--------------------------------------------------------- */
const { isDuplicateKey, normalizeBodyForDedup, hashString } = require('../services/dedupStore');
const { datas_disponiveis } = require('../app/intents/prompts');

// In-memory inbound dedup per process (avoids suppressing first delivery after restart)
const inboundSeen = new Map(); // id -> ts
const INBOUND_TTL_MS = 5 * 1000;       // 5s
const OUTBOUND_TTL_MS = 15 * 1000;     // 15s
const SENDER_COOLDOWN_MS = 800;        // 800ms
const RESPOND_ONCE_TTL_MS = 30 * 1000; // 30s
function inboundIsDuplicate(id) {
  if (!id) return false;
  const now = Date.now();
  for (const [k, ts] of inboundSeen) {
    if (now - ts > INBOUND_TTL_MS) inboundSeen.delete(k);
  }
  if (inboundSeen.has(id)) return true;
  inboundSeen.set(id, now);
  return false;
}

router.post('/', express.urlencoded({ extended: false }), async (req, res) => { // Adicionado urlencoded para Twilio audio
  // Log da requisição completa para depuração (semelhante ao webhook_voz)
  console.log('--- [Webhook Unificado] INCOMING REQUEST ---');
  // console.log('Headers:', JSON.stringify(req.headers, null, 2)); // verbose
  // console.log('Body:', JSON.stringify(req.body, null, 2)); // verbose

  // WAHA: deduplicar pelo ID mapeado no adapter, quando disponível
  const incomingId = req.body?._waha?.messageId;
  if (incomingId) {
    if (inboundIsDuplicate(String(incomingId))) {
      console.log('[DEDUP][INBOUND][MSGID] hit', JSON.stringify({ messageId: incomingId, ttlMs: INBOUND_TTL_MS }));
      return res.status(200).json({ status: 'ignored-duplicate' });
    }
  }

  // Fallback: dedup por conteúdo (From|Body) em janela curta, para casos onde WAHA muda o ID
  const fromKey = req.body?.From || '';
  const rawBody = (typeof req.body.Body === 'string' ? req.body.Body : '') || '';
  const norm = normalizeBodyForDedup(rawBody);
  const bodyKey = norm.normalized;

  // Cooldown por remetente: evita processar duas entradas do mesmo remetente em janela muito curta
  if (!global.__senderCooldown) global.__senderCooldown = new Map();
  const lastTs = global.__senderCooldown.get(fromKey) || 0;
  const nowTs = Date.now();
  if (fromKey && nowTs - lastTs < SENDER_COOLDOWN_MS) {
    console.log('[DEDUP][INBOUND][COOLDOWN] hit', JSON.stringify({ from: fromKey, cooldownMs: SENDER_COOLDOWN_MS }));
    return res.status(200).json({ status: 'ignored-cooldown' });
  }
  global.__senderCooldown.set(fromKey, nowTs);

  const compositeKey = `${fromKey}|${bodyKey}`;

  // Guardião de resposta única por evento de entrada
  if (!global.__respondedOnce) global.__respondedOnce = new Map(); // key -> ts
  function hasResponded(key) {
    const now = Date.now();
    // prune
    for (const [k, ts] of global.__respondedOnce) {
      if (now - ts > RESPOND_ONCE_TTL_MS) global.__respondedOnce.delete(k);
    }
    return global.__respondedOnce.has(key);
  }
  function markResponded(key) {
    global.__respondedOnce.set(key, Date.now());
  }

  const respondKey = incomingId ? `id:${incomingId}` : `key:${compositeKey}`;
  // Guard contra processamento concorrente do mesmo evento
  if (!global.__processingLocks) global.__processingLocks = new Map(); // key -> ts
  const nowLock = Date.now();
  // Limpa locks antigos
  for (const [k, ts] of global.__processingLocks) {
    if (nowLock - ts > RESPOND_ONCE_TTL_MS) global.__processingLocks.delete(k);
  }
  if (global.__processingLocks.has(respondKey)) {
    console.log('[DEDUP][INBOUND][LOCK] already-processing', JSON.stringify({ respondKey }));
    return res.status(200).json({ status: 'ignored-processing' });
  }
  global.__processingLocks.set(respondKey, nowLock);
  if (hasResponded(respondKey)) {
    console.log('[DEDUP][INBOUND][RESPOND-ONCE] hit', JSON.stringify({ respondKey, ttlMs: RESPOND_ONCE_TTL_MS }));
    global.__processingLocks.delete(respondKey);
    return res.status(200).json({ status: 'ignored-already-responded' });
  }
  if (fromKey && bodyKey) {
    if (isDuplicateKey(compositeKey, INBOUND_TTL_MS)) {
      console.log('[DEDUP][INBOUND][BODY] hit', JSON.stringify({ key: compositeKey, from: fromKey, body: bodyKey, ttlMs: INBOUND_TTL_MS }));
      global.__processingLocks.delete(respondKey);
      return res.status(200).json({ status: 'ignored-duplicate' });
    }
  }

  let mensagem = '';
  if (typeof req.body.Body === 'string') {
    mensagem = req.body.Body.trim();
  } else if (req.body.Body) {
    mensagem = String(req.body.Body).trim();
  } else {
    mensagem = '';
  }
  const numero = req.body.From;
  const audioUrl = req.body.MediaUrl0;

  // Log inbound resumido
  console.log('[WEBHOOK] inbound:', { From: numero, Body: mensagem, messageId: incomingId });

  if (!mensagem && audioUrl) {
    try {
      console.log('[Webhook Unificado] Baixando áudio do Twilio:', audioUrl);
      const audioBuffer = await baixarAudioTwilio(audioUrl);
      console.log('[Webhook Unificado] Áudio baixado, enviando para transcrição...');
      const textoTranscrito = await transcreverAudioWhisper(audioBuffer, 'audio.ogg'); // Assumindo ogg, ajuste se necessário
      mensagem = textoTranscrito || '(Áudio recebido, mas não foi possível transcrever)';
      console.log('[Webhook Unificado] Texto transcrito:', mensagem);
    } catch (err) {
      console.error('[Webhook Unificado] Erro ao processar/transcrever áudio:', err.message);
      mensagem = 'Recebi um áudio, mas ocorreu um erro ao tentar processá-lo.';
    }
  }

  if (!mensagem) {
    console.log('[Webhook Unificado] Nenhuma mensagem de texto ou áudio válido recebido. Usando mensagem padrão.');
    mensagem = 'Não entendi o que você disse ou enviou.'; 
  }

  /* -------------------- 1. Recupera/Cria sessão ------------------- */
  const user = usuarios[numero] ?? {
    numero, // Garante que o número sempre está presente
    etapa: 'inicio', etapaAnterior: '', etapaAtual: 'inicio',
    mensagemAnteriorGPT: '', mensagemAnteriorCliente: '',
    cpf: null, clienteId: null, nomeCliente: null,
    osList: [], osEscolhida: null,           // osEscolhida é SEMPRE objeto
    ultimaListaOS: [],                       // última lista exibida ao usuário (em ordem)
    dataInterpretada: null, periodoAgendamento: null
  };
  // Sempre sincroniza o número na sessão
  user.numero = numero;

  /* -------------------- 2. Gera contexto p/ LLM ------------------- */
  const dados = geraDados(user, mensagem);
  let contexto = gerarPromptContextualizado(dados);
  
  // Adicionar contexto da última pergunta para melhorar detecção de intent
  if (user.tipoUltimaPergunta === 'DETALHES_VISITA') {
    contexto += '\n\nCONTEXTO IMPORTANTE: A última mensagem do sistema perguntou "Deseja ver detalhes do dia da visita?". Se o usuário responder afirmativamente (sim, yes, quero, gostaria, etc.), a intent deve ser "mais_detalhes".';
  }

  // Adicionar contexto para confirmação de agendamento
  if (user.tipoUltimaPergunta === 'AGENDAMENTO_SUGESTAO') {
    contexto += '\n\nCONTEXTO IMPORTANTE: A última mensagem do sistema foi uma sugestão de agendamento. Se o usuário responder afirmativamente (sim, ok, pode ser, fechado, etc.) SEM mencionar outra data ou período, a intent DEVE ser "confirmar_agendamento".';
  }
  let resposta = '';

  try {
    /* -------------------- 3. Detecta INTENT ----------------------- */
    console.log('🟦 [DEBUG] Chamando detectarIntentComContexto com:', {
      mensagem,
      agentId: 'agent_os',
      promptExtra: contexto,
      intentAnterior: user.etapaAnterior,
      mensagemAnteriorGPT: user.mensagemAnteriorGPT
    });
    let intentResult = null;
    try {
      intentResult = await detectarIntentComContexto({
        mensagem, // Usa a mensagem (texto original ou transcrito)
        agentId: 'agent_os',
        promptExtra: contexto,
        intentAnterior: user.etapaAnterior,
        mensagemAnteriorGPT: user.mensagemAnteriorGPT
      });
      console.log('🟩 [DEBUG] Resultado detectarIntentComContexto:', intentResult);
    } catch (errIntent) {
      console.error('🟥 [ERRO] detectarIntentComContexto:', errIntent);
      throw errIntent;
    }
    const { intent } = intentResult;

    user.etapaAtual = intent;
    
    // Limpar contexto da última pergunta se foi usado para detecção de intent
    if (user.tipoUltimaPergunta === 'DETALHES_VISITA' && intent === 'mais_detalhes') {
      console.log('[DEBUG] Limpando tipoUltimaPergunta após detecção correta de mais_detalhes');
      user.tipoUltimaPergunta = null;
    }

    // Limpar contexto de sugestão de agendamento após uso
    if (user.tipoUltimaPergunta === 'AGENDAMENTO_SUGESTAO' && intent === 'confirmar_agendamento') {
      console.log('[DEBUG] Limpando tipoUltimaPergunta após detecção correta de confirmar_agendamento');
      user.tipoUltimaPergunta = null;
    }

    console.log("================== Nova Intent Detectada ==================")
    console.log("==================" + intent + "=============================")
    console.log("================== Nova Intent Detectada ==================")

    /* -------------------- 4. Fluxo principal ---------------------- */
      switch (intent) {

        case 'extrair_cpf':{
          // Limpar todas as variáveis de sessão quando um novo CPF é informado
          // Isso garante que não haja dados residuais de sessões anteriores
          user.osEscolhida = null;
          user.dataInterpretada = null;
          user.periodoAgendamento = null;
          user.sugestaoData = null;
          user.sugestaoPeriodo = null;
          user.sugestoesAgendamento = null;
          user.osList = null;
          user.tipoUltimaPergunta = null;
          user.etapaAtual = null;
          user.etapaAnterior = null;
          user.mensagemAnteriorCliente = null;
          user.mensagemAnteriorGPT = null;
          // console.log('[DEBUG] extrair_cpf: user.osList', user.osList); // LOG-OS-INTEIRAão limpas para novo CPF');
          resposta = user._respostaCPF;
          const cpf = extrairCpf(mensagem);
          
          // Verificar se o usuário pode estar tentando informar um número de OS em vez de CPF
          const possibleOsNumber = mensagem.replace(/[^\d]/g, '');
          const isLikelyOsNumber = possibleOsNumber.length !== 11 && possibleOsNumber.length > 0;
          
          if (!cpf) { 
            if (isLikelyOsNumber) {
              resposta = 'Parece que você digitou um número que pode ser uma OS. Para confirmar, por favor me informe seu CPF primeiro (11 dígitos, ex: 12345678900 ou 123.456.789-00), e depois poderei verificar suas ordens de serviço.';
            } else {
              resposta = 'Parece que o formato do CPF não está correto. Por favor, digite novamente com 11 dígitos (ex: 12345678900 ou 123.456.789-00).';
            }
            break; // Interrompe a execução quando CPF é inválido
          }
    
          user.cpf = cpf;
          let osAbertas = [];
          let osAgendadas = [];
          let cliente = null;
          try {
            console.log('[DEBUG] Chamando buscarClientePorCpf com CPF:', cpf);
            cliente = await buscarClientePorCpf(cpf);
          } catch (errCliente) {
            if (errCliente.response) {
              // Axios error
              console.error('[ERRO] buscarClientePorCpf - status:', errCliente.response.status);
              console.error('[ERRO] buscarClientePorCpf - data:', errCliente.response.data);
              console.error('[ERRO] buscarClientePorCpf - headers:', errCliente.response.headers);
            } else {
              console.error('[ERRO] buscarClientePorCpf:', errCliente);
            }
            
            // Fornecer uma mensagem amigável ao usuário com base no tipo de erro
            if (errCliente.response && errCliente.response.status === 401) {
              resposta = 'Desculpe, estamos enfrentando problemas de autenticação com nosso sistema. Por favor, tente novamente mais tarde ou entre em contato com nosso suporte técnico.';
            } else if (errCliente.response && errCliente.response.status === 404) {
              resposta = 'Não encontramos nenhum cliente cadastrado com este CPF. Por favor, verifique se o número está correto ou entre em contato com nosso suporte para mais informações.';
            } else {
              resposta = 'Desculpe, ocorreu um problema ao buscar seus dados. Por favor, tente novamente mais tarde ou entre em contato com nosso suporte técnico.';
            }
            
            // Registrar o erro técnico apenas no log, não para o usuário
            console.error('Erro técnico completo:', (errCliente.response ? errCliente.response.status + ' - ' + JSON.stringify(errCliente.response.data) : errCliente.message));
            user.clienteId = null;
            user.nomeCliente = null;
            // Não precisamos sair do fluxo, apenas definimos a resposta e continuamos normalmente
            break;
          }
          
          console.log("================== mensagem ==================")  
          console.log("==================" + mensagem + "=============================")
          console.log("================== cpf ==================")  
          console.log("==================" + cpf + "=============================")
          console.log("================== cliente ==================")
          console.log("==================" + JSON.stringify(cliente) + "=============================")
          console.log("==================================")
          
          if (!cliente?.cliente?.id) {
            resposta = cliente.mensagem || 'CPF não encontrado. Pode reenviar?';
            user.clienteId = null;
            user.nomeCliente = null;
          } else {
            user.clienteId = cliente.cliente.id;
            user.nomeCliente = cliente.cliente.razao;
    
            const lista = await buscarOSPorClienteId(user.clienteId);
            
            // LOG DETALHADO DE CADA OS ANTES DA FILTRAGEM
            // console.log(`[DEBUG] extrair_cpf - ANÁLISE DETALHADA DAS OS:`);
            // lista.forEach((os, index) => {
            //   console.log(`[DEBUG] OS ${index + 1}/${lista.length}: ID=${os.id}, status='${os.status}', data_agenda_final='${os.data_agenda_final}', melhor_horario_agenda='${os.melhor_horario_agenda}'`);
            // });
            
            osAbertas = lista.filter(o => o.status === 'A');
            osAgendadas = lista.filter(o => o.status === 'AG');
            user.osList = lista.filter(o => ['A', 'AG', 'EN'].includes(o.status));
    
            // LOGS DETALHADOS PARA DEBUG
            // console.log(`[DEBUG] extrair_cpf - Total de OS encontradas: ${lista.length}`);
            // console.log(`[DEBUG] extrair_cpf - OS Abertas (status='A'): ${osAbertas.length}`);
            // console.log(`[DEBUG] extrair_cpf - OS Agendadas (status='AG'): ${osAgendadas.length}`);
            // console.log(`[DEBUG] extrair_cpf - IDs das OS Abertas: ${osAbertas.map(o => o.id).join(', ')}`);
            // console.log(`[DEBUG] extrair_cpf - IDs das OS Agendadas: ${osAgendadas.map(o => o.id).join(', ')}`);
            
            let partes = [`✅ Cadastro localizado, ${user.nomeCliente}.`];

            // Se houver exatamente 1 OS aberta, seleciona automaticamente e já sugere data
            if (osAbertas.length === 1) {
              user.osEscolhida = osAbertas[0];
              const assunto = formatarDescricaoOS(user.osEscolhida);
              const osInfo = `• ${user.osEscolhida.id} - ${assunto}`;

              try {
                const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida);
                if (sugestoes?.sugestao?.data && sugestoes?.sugestao?.periodo) {
                  user.sugestaoData = sugestoes.sugestao.data;
                  user.sugestaoPeriodo = sugestoes.sugestao.periodo;
                  user.id_tecnico = sugestoes.sugestao.id_tecnico;
                  user.tipoUltimaPergunta = 'AGENDAMENTO_SUGESTAO';

                  const dataFormatada = dayjs(sugestoes.sugestao.data).format('DD/MM/YYYY');
                  const diaSemana = diaDaSemanaExtenso(sugestoes.sugestao.data);
                  const periodoExtenso = sugestoes.sugestao.periodo === 'M' ? 'manhã' : 'tarde';

                  // Alternativas (até 3, únicas)
                  let alternativas = '';
                  if (sugestoes.alternativas && sugestoes.alternativas.length > 0) {
                    const alternativasUnicas = [];
                    for (const alt of sugestoes.alternativas) {
                      if (!alternativasUnicas.some(a => a.data === alt.data && a.periodo === alt.periodo)) {
                        alternativasUnicas.push(alt);
                      }
                      if (alternativasUnicas.length >= 3) break;
                    }
                    alternativas = alternativasUnicas.map(alt => {
                      const dataAlt = dayjs(alt.data).format('DD/MM/YYYY');
                      const diaAlt = diaDaSemanaExtenso(alt.data);
                      const periodoAlt = alt.periodo === 'M' ? 'manhã' : 'tarde';
                      return `• ${diaAlt}, ${dataAlt} pela ${periodoAlt}`;
                    }).join('\n');
                  }

                  partes.push(`Encontrei 1 OS aberta e já selecionei para você:\n${osInfo}`);
                  partes.push(`Minha melhor sugestão é ${diaSemana}, ${dataFormatada}, no período da ${periodoExtenso}.` + (alternativas ? `\n\nSe preferir, também tenho:\n${alternativas}` : ''));
                  partes.push('Fica bom para você ou prefere outra data?');
                  resposta = partes.join('\n\n');
                  break;
                } else {
                  // Sem sugestões válidas: usar mensagem de indisponibilidade apropriada
                  const mensagemIndisponibilidade = tratarIndisponibilidadeAgendamento(user);
                  partes.push(`Encontrei 1 OS aberta:\n${osInfo}`);
                  partes.push(mensagemIndisponibilidade);
                  resposta = partes.join('\n\n');
                  break;
                }
              } catch (e) {
                console.error('[extrair_cpf] Erro ao gerar sugestões para OS única:', e);
                const mensagemIndisponibilidade = tratarIndisponibilidadeAgendamento(user);
                partes.push(`Encontrei 1 OS aberta:\n${osInfo}`);
                partes.push(mensagemIndisponibilidade);
                resposta = partes.join('\n\n');
                break;
              }
            }
            
            // Mostrar OS ABERTAS primeiro (disponíveis para agendamento)
            if (osAbertas.length > 0) {
              // console.log(`[DEBUG] extrair_cpf - Adicionando ${osAbertas.length} OS abertas à resposta`);
              const listaAbertas = formatarListaOS(osAbertas, false); // false = sem data pois estão abertas
              partes.push(`Encontrei ${osAbertas.length} ordem(ns) de serviço aberta(s) disponível(eis) para agendamento:\n${listaAbertas}`);
              partes.push('Você pode escolher uma delas para agendar. Qual gostaria de agendar?');
            } else if (osAgendadas.length > 0) {
              // Só mostrar OS AGENDADAS se NÃO houver OS abertas
              // console.log(`[DEBUG] extrair_cpf - Nenhuma OS aberta, mostrando ${osAgendadas.length} OS agendadas`);
              const listaAgendadas = formatarListaOS(osAgendadas, true); // true para incluir a data
              partes.push(`Encontrei ${osAgendadas.length} visita(s) já agendada(s):\n${listaAgendadas}`);
              partes.push('Você pode pedir para ver detalhes ou reagendar uma delas, se precisar.');
            }

            // Caso não tenha nenhuma OS
            if (osAbertas.length === 0 && osAgendadas.length === 0) {
              // console.log(`[DEBUG] extrair_cpf - Nenhuma OS encontrada para o cliente`);
              partes.push('Não encontrei nenhuma ordem de serviço aberta ou agendada para você no momento.');
            }
            
            // console.log(`[DEBUG] extrair_cpf - Resposta final montada com ${partes.length} partes`);
            
            resposta = partes.join('\n\n');
            // console.log(`[DEBUG] extrair_cpf - Resposta completa: ${resposta}`);
          }
          break;
        }
        case 'recusar_cancelar': {
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }
          // Limpa variáveis relacionadas ao fluxo
          user.osEscolhida = null;
          user.dataInterpretada = null;
          user.periodoAgendamento = null;
          // user.etapaAtual = 'inicio';
          user.etapaAnterior = '';
          resposta = 'Vou cancelar esse atendimento por hora, assim que pensar melhor retorne para fazer o agendamento 😊';

          // Após finalizar/cancelar, recarrega a lista de OS do cliente
          if (user.clienteId) {
            console.log(`Recarregando lista de OS após cancelamento para o cliente ${user.clienteId}`);
            try {
              buscarOSPorClienteId(user.clienteId)
                .then(osListAtualizada => {
                  if (osListAtualizada && osListAtualizada.length > 0) {
                    user.osList = osListAtualizada;
                    console.log(`Lista de OS recarregada após cancelamento: ${osListAtualizada.length} OS`);
                  } else {
                    user.osList = [];
                  }
                })
                .catch(err => console.error('Erro ao recarregar OS após cancelamento:', err));
            } catch (e) {
              console.error('Falha ao iniciar recarga de OS após cancelamento:', e);
            }
          }
          break;
        }
        case 'mudar_de_os': {
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }

          // Limpar variáveis e retornar para a listagem de OS
          user.osEscolhida = null;
          user.dataInterpretada = null;
          user.periodoAgendamento = null;

          const lista = await buscarOSPorClienteId(user.clienteId);
          if (!lista || lista.length === 0) {
            resposta = 'Não encontrei nenhuma ordem de serviço para você no momento.';
            break;
          }

          const osAbertas = lista.filter(o => o.status === 'A');
          const osAgendadas = lista.filter(o => o.status === 'AG');

          if (osAbertas.length > 0) {
            user.ultimaListaOS = [...osAbertas];
            const listaAbertas = formatarListaOS(osAbertas, false);
            resposta = `Sem problemas! Aqui estão suas OS abertas disponíveis para agendamento:\n\n${listaAbertas}\n\nQual delas você gostaria de agendar?`;
          } else if (osAgendadas.length > 0) {
            user.ultimaListaOS = [...osAgendadas];
            const listaAg = formatarListaOS(osAgendadas, true);
            resposta = `No momento você não tem OS abertas, mas possui visitas agendadas:\n\n${listaAg}\n\nSe quiser reagendar alguma, é só me dizer o número.`;
          } else {
            user.ultimaListaOS = [];
            resposta = 'Você não tem ordens de serviço abertas ou agendadas no momento.';
          }

          break;
        }
        case 'listar_opcoes': {
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }
          
          //retorna ABERTAS, AGENDADAS ou TODAS
          const tipoListagem = await verificaTipoListagem(mensagem, 'agent_os', user, intent, mensagem, contexto);
          
          if (tipoListagem === 'ABERTAS') {
            console.log(`[DEBUG] listar_opcoes: Usuário perguntou sobre OS abertas - mensagem: "${mensagem}"`);
            
            const lista = await buscarOSPorClienteId(user.clienteId);
            const osAbertas = lista.filter(o => o.status === 'A');
            
            console.log(`[DEBUG] listar_opcoes - Total de OS: ${lista.length}`);
            console.log(`[DEBUG] listar_opcoes - OS Abertas encontradas: ${osAbertas.length}`);
            console.log(`[DEBUG] listar_opcoes - IDs das OS Abertas: ${osAbertas.map(o => o.id).join(', ')}`);
            
            if (osAbertas.length > 0) {
              // Salva a ordem exata apresentada ao usuário
              user.ultimaListaOS = [...osAbertas];
              const listaAbertas = formatarListaOS(osAbertas, false); // false = sem data pois estão abertas
              resposta = `Olá, ${user.nomeCliente}! Você tem ${osAbertas.length} ordem(ns) de serviço aberta(s) disponível(eis) para agendamento:\n\n${listaAbertas}\n\nQual gostaria de agendar?`;
            } else {
              resposta = `${user.nomeCliente}, você não tem nenhuma ordem de serviço aberta no momento. Todas as suas OS já estão agendadas ou finalizadas.`;
            }
            break;
          }
          
          if (tipoListagem === 'AGENDADAS') {
            console.log(`[DEBUG] listar_opcoes: Usuário perguntou sobre OS agendadas - mensagem: "${mensagem}"`);
            
            const lista = await buscarOSPorClienteId(user.clienteId);
            const osAgendadas = lista.filter(o => o.status === 'AG');
            
            console.log(`[DEBUG] listar_opcoes - Total de OS: ${lista.length}`);
            console.log(`[DEBUG] listar_opcoes - OS Agendadas encontradas: ${osAgendadas.length}`);
            console.log(`[DEBUG] listar_opcoes - IDs das OS Agendadas: ${osAgendadas.map(o => o.id).join(', ')}`);
            
            if (osAgendadas.length > 0) {
              // Salva a ordem exata apresentada ao usuário
              user.ultimaListaOS = [...osAgendadas];
              const listaAgendadas = formatarListaOS(osAgendadas, true); // true para incluir data
              resposta = `Sim, ${user.nomeCliente}! Você tem ${osAgendadas.length} visita(s) já agendada(s):\n\n${listaAgendadas}\n\nSe precisar reagendar ou ver mais detalhes de alguma, é só me avisar!`;
            } else {
              resposta = `Não, ${user.nomeCliente}. Você não tem nenhuma visita agendada no momento. Mas você tem ordens de serviço abertas que podem ser agendadas. Gostaria de ver a lista delas?`;
            }
            break;
          }
          
          // Caso TODAS - mostra todas as OS (abertas e agendadas)
          if (tipoListagem === 'TODAS') {
            console.log(`[DEBUG] listar_opcoes: Usuário perguntou sobre todas as OS - mensagem: "${mensagem}"`);
            
            const lista = await buscarOSPorClienteId(user.clienteId);
            const osAbertas = lista.filter(o => o.status === 'A');
            const osAgendadas = lista.filter(o => o.status === 'AG');
            
            console.log(`[DEBUG] listar_opcoes - Total de OS: ${lista.length}`);
            console.log(`[DEBUG] listar_opcoes - OS Abertas: ${osAbertas.length}, OS Agendadas: ${osAgendadas.length}`);
            
            let resposta_partes = [`Olá, ${user.nomeCliente}! Aqui estão todas as suas ordens de serviço:`];
            
            if (osAbertas.length > 0) {
              const listaAbertas = formatarListaOS(osAbertas, false);
              resposta_partes.push(`\n🔓 **OS Abertas (${osAbertas.length}) - Disponíveis para agendamento:**\n${listaAbertas}`);
            }
            
            if (osAgendadas.length > 0) {
              const listaAgendadas = formatarListaOS(osAgendadas, true);
              resposta_partes.push(`\n📅 **OS Agendadas (${osAgendadas.length}):**\n${listaAgendadas}`);
            }
            
            if (osAbertas.length === 0 && osAgendadas.length === 0) {
              resposta = `${user.nomeCliente}, você não tem nenhuma ordem de serviço no momento.`;
            } else {
              resposta_partes.push(`\n\nPrecisa agendar alguma OS aberta ou ver detalhes de alguma agendada? É só me avisar!`);
              // Ao mostrar todas, convencionamos que a "lista ativa" é a última seção apresentada ao usuário
              // Para evitar ambiguidade, vamos armazenar somente a parte ABERTAS, se existir; senão, AGENDADAS
              if (osAbertas.length > 0) {
                user.ultimaListaOS = [...osAbertas];
              } else if (osAgendadas.length > 0) {
                user.ultimaListaOS = [...osAgendadas];
              } else {
                user.ultimaListaOS = [];
              }
              resposta = resposta_partes.join('');
            }
            break;
          }
          
          // Fallback - caso não seja detectado nenhum tipo específico
          console.log(`[DEBUG] listar_opcoes: Tipo não identificado (${tipoListagem}) - usando fallback`);
          user.osEscolhida = null;
          // Monta lista de OS disponíveis
          let osMsg = 'Nenhuma OS disponível.';
          if (user.osList && user.osList.length) {
            osMsg = formatarListaOS(user.osList);
          }
          // Monta lista de datas/horários sugeridos
          let datasMsg = 'Nenhuma sugestão disponível.';
          if (user.sugestaoData || user.sugestaoHora) {
            datasMsg = '';
            if (user.sugestaoData) datasMsg += `Data sugerida: ${user.sugestaoData}`;
            if (user.sugestaoHora) datasMsg += `${datasMsg ? ' | ' : ''}Período sugerido: ${user.sugestaoPeriodo === 'M' ? 'manhã' : 'tarde'}`;
          }
          resposta = `Aqui estão as opções disponíveis:\n\nOrdens de Serviço (OS):\n${osMsg}\n\nSe quiser escolher uma OS, basta me dizer o número. Para agendar, é só informar a data e o período (manhã ou tarde) que preferir!`;
          break;
        }
        case 'inicio': {
          // This check ensures that if a user somehow re-enters 'inicio' after providing CPF, they aren't asked again.
          // However, the primary goal of 'inicio' if no CPF is present, is to ask for it.
          if (!user.clienteId) {
            resposta = 'Olá! Sou a Jaqueline, sua assistente virtual da Ibiunet. Para agilizar seu atendimento, por favor, me informe seu CPF.';
            user.tipoUltimaPergunta = 'CPF';
          } else {
            // Se já conhece o cliente, oferece ajuda diretamente
            resposta = `Olá, ${user.nomeCliente}! Como posso te ajudar hoje? Precisa agendar um serviço ou verificar uma OS?`;
          }
          break;
        }
        case 'aleatorio': {
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }
          // Verificar se o usuário está respondendo a uma sugestão de OS
          if (user.etapaAtual === 'escolher_os' && user.osList && user.osList.length > 0) {
            // Tentar extrair o número da OS da mensagem do usuário
            const osPattern = /\b(\d{4,6})\b/; // Padrão para encontrar números de 4-6 dígitos (formato típico de OS)
            const osMatch = mensagem.match(osPattern);
            
            if (osMatch) {
              const osIdExtraido = osMatch[1];
              console.log(`Número de OS extraído da mensagem: ${osIdExtraido}`);
              
              // Verificar se a OS existe na lista do usuário
              const osEncontrada = user.osList.find(os => os.id === osIdExtraido);
              if (osEncontrada) {
                // Definir a OS escolhida e atualizar a etapa
                user.osEscolhida = osEncontrada;
                // user.etapaAtual = 'agendar_data';
                user.etapaAnterior = 'escolher_os';
                
                // Gerar sugestões de agendamento para a OS escolhida
                const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida);
                
                // Verificar se foram encontradas sugestões
                if (sugestoes?.sugestao?.data && sugestoes?.sugestao?.periodo) {
                  user.sugestaoData = sugestoes.sugestao.data;
                  user.sugestaoPeriodo = sugestoes.sugestao.periodo;
                  user.id_tecnico = sugestoes.sugestao.id_tecnico;
                  
                  // Formatar a data e o período para a mensagem
                  const dataFormatada = dayjs(sugestoes.sugestao.data).format('DD/MM/YYYY');
                  const diaSemana = diaDaSemanaExtenso(sugestoes.sugestao.data);
                  // Capitalizar primeira letra do dia da semana
                  const diaSemanaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
                  const periodoExtenso = sugestoes.sugestao.periodo === 'M' ? 'manhã' : 'tarde';
                  const assunto = formatarDescricaoOS(user.osEscolhida);
                  
                  resposta = `Ótimo! Vamos agendar a ${assunto}. ` +
                           `Que tal ${diaSemanaCapitalizado}, dia ${dataFormatada}, no período da ${periodoExtenso}? ` +
                           `Está bom para você ou prefere outra data?`;
                } else {
                  console.log(`[DEBUG] Não foram encontradas sugestões de agendamento para a OS ${user.osEscolhida.id}`);
                  
                  // Verificar se o usuário tem outras OS que poderiam ser agendadas
                  const outrasOS = user.osList.filter(os => os.id !== user.osEscolhida.id);
                  
                  if (outrasOS.length > 0) {
                    // Tem outras OS para tentar agendar
                    const listaOS = formatarListaOS(outrasOS);
                    resposta = `Infelizmente, não consegui encontrar horários disponíveis para agendar a OS ${user.osEscolhida.id}. ` +
                      `Isso pode ocorrer devido à falta de técnicos disponíveis para o setor desta OS.\n\n` +
                      `Você possui outras ordens de serviço que podemos tentar agendar:\n${listaOS}\n\n` +
                      `Gostaria de tentar agendar alguma destas?`;
                    
                    // Limpar a OS escolhida para que o usuário possa selecionar outra
                    user.osEscolhida = null;
                break;
              } else {
                resposta = tratarIndisponibilidadeAgendamento(user);
                
                // Limpar estados
                user.osEscolhida = null;
                user.aguardandoConfirmacao = false;
                break;
              }
            }
            break;
          }
        }
      }
      
      // Se não for relacionado a uma sugestão de OS, continuar com o fluxo normal
      // The !user.cpf check is now redundant due to ensureClienteId
      if (['verificar_os', 'escolher_os', 'agendar_data', 'extrair_data', 'extrair_hora', 'confirmar_agendamento'].includes(user.etapaAnterior)) {
        resposta = await gerarMensagemDaIntent({ intent, agentId: 'agent_os', dados: contexto, promptExtra: 'Solicite que o cliente conclua a etapa anterior.' });
      } else {
        resposta = await gerarMensagemDaIntent({ intent, agentId: 'agent_os', dados: contexto });
      }
      break;

          // Detectar preferência do usuário: "aberta" vs "agendada"
          const msgNorm = (mensagem || '').toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          const querAbertas = /aberta|aberto/.test(msgNorm);
          const querAgendadas = /agendada|agendado|agendada[s]?|detalhe|visita|marcada|reagendar/.test(msgNorm);

          const partes = [];
          // Prefácio amigável
          partes.push(`Certo, vou verificar suas ordens de serviço agora.`);

          const addAbertas = () => {
            if (osAbertas.length) {
              const listaAbertas = formatarListaOS(osAbertas);
              const plural = osAbertas.length > 1;
              partes.push(
                `Você tem ${osAbertas.length} OS aberta${plural ? 's' : ''}:
${listaAbertas}

Gostaria de agendar ${plural ? 'alguma delas' : 'esta OS'}?`
              );
            } else {
              partes.push('No momento você não tem OS abertas.');
            }
          };

          const addAgendadas = () => {
            if (osAgendadas.length) {
              const listaAgendadas = formatarListaOS(osAgendadas);
              const plural = osAgendadas.length > 1;
              partes.push(
                `Você tem ${osAgendadas.length} OS agendada${plural ? 's' : ''}:
${listaAgendadas}

Gostaria de ver mais detalhes ou reagendar ${plural ? 'alguma delas' : 'esta OS'}?`
              );
            }
          };

          if (querAbertas && !querAgendadas) {
            // Usuário perguntou especificamente por abertas
            addAbertas();
            if (!osAbertas.length && osAgendadas.length) {
              // Ajuda adicional se não houver abertas
              addAgendadas();
            }
          } else if (querAgendadas && !querAbertas) {
            addAgendadas();
            if (!osAgendadas.length && osAbertas.length) {
              addAbertas();
            }
          } else {
            // Genérico: mostrar abertas primeiro, depois agendadas
            addAbertas();
            addAgendadas();
            if (!osAbertas.length && !osAgendadas.length) {
              partes.push('Não há OS abertas ou agendadas no momento.');
            }
          }

          resposta = partes.join('\n\n');
          break;
        }
        case 'escolher_os': {
          console.log("\n[LOG] ➡️ Entrando no case 'escolher_os'\n");
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }
          const resultado = await processarEscolhaOS({
            mensagem,
            contexto,
            intent,
            osList: user.osList
          });
          
          if (resultado.resposta) {
            resposta = resultado.resposta;
            break;
          }
          
          // Define a OS escolhida
          user.osEscolhida = resultado.osObj;

          // Validar se a OS foi definida corretamente
          if (!user.osEscolhida) {
            resposta = 'Erro ao selecionar a OS. Por favor, tente novamente.';
            break;
          }

          // Verificar o status da OS selecionada
          if (user.osEscolhida.status === 'AG') {
            // OS já está agendada - perguntar se quer mais informações ou reagendar
            const dataAgendada = user.osEscolhida.data_agenda_final ? 
              dayjs(user.osEscolhida.data_agenda_final).format('DD/MM/YYYY') : 'data não definida';
            const periodoAgendado = user.osEscolhida.melhor_horario_agenda === 'M' ? 'manhã' : 'tarde';
            const diaSemanaAgendado = user.osEscolhida.data_agenda_final ? 
                                    diaDaSemanaExtenso(user.osEscolhida.data_agenda_final) : '';
            const assunto = formatarDescricaoOS(user.osEscolhida);
            
            // Marcar que a última pergunta foi um menu numerado específico
            user.tipoUltimaPergunta = 'MENU_OS_AGENDADA';
            
            resposta = `Você selecionou a OS ${user.osEscolhida.id} (${assunto}) que já está agendada para ${diaSemanaAgendado}, ` +
                      `dia ${dataAgendada}, no período da ${periodoAgendado}.\n\n` +
                      `O que você gostaria de fazer?\n` +
                      `1. Ver mais detalhes desta OS\n` +
                      `2. Reagendar esta visita\n` +
                      `3. Voltar para a lista de OS`;
            break;
          }
          
          // Se a OS está aberta (status = 'A'), seguir com o fluxo normal de agendamento
          const slaHoras = user.osEscolhida.sla_horas || 72;
          const prioridade = 0; // ou obtenha do contexto/usuário
          const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida, slaHoras, prioridade);

          if (!sugestoes || !sugestoes.sugestao) {
            resposta = tratarIndisponibilidadeAgendamento(user);
            break;
          }

          // Formatar mensagem com sugestão principal e até 3 alternativas
          const dataSug = sugestoes.sugestao.data;
          const periodoSug = sugestoes.sugestao.periodo;

          // Armazenar a sugestão principal para uso na confirmação
          user.sugestaoData = dataSug;
          user.sugestaoPeriodo = periodoSug;
          user.tipoUltimaPergunta = 'AGENDAMENTO_SUGESTAO'; // Indica que uma sugestão foi feita
          console.log(`[DEBUG] Sugestão principal armazenada para confirmação: Data=${user.sugestaoData}, Período=${user.sugestaoPeriodo}`);

          const dataFormatada = dayjs(dataSug).format('DD/MM/YYYY');
          const diaSemana = diaDaSemanaExtenso(dataSug);
          const periodoExtenso = periodoSug === 'M' ? 'manhã' : 'tarde';
          const assunto = formatarDescricaoOS(user.osEscolhida);

          // Alternativas
          let alternativas = '';
          if (sugestoes.alternativas && sugestoes.alternativas.length > 0) {
            // Agrupa alternativas por data/periodo, evita duplicidade
            const alternativasUnicas = [];
              
            for (const alt of sugestoes.alternativas) {
              if (!alternativasUnicas.some(a => a.data === alt.data && a.periodo === alt.periodo)) {
                alternativasUnicas.push(alt);
              }
              if (alternativasUnicas.length >= 3) break;
            }
            
            alternativas = alternativasUnicas.map(alt => {
              const dataAlt = dayjs(alt.data).format('DD/MM/YYYY');
              const diaAlt = diaDaSemanaExtenso(alt.data);
              const periodoAlt = alt.periodo === 'M' ? 'manhã' : 'tarde';
              return `• ${diaAlt}, ${dataAlt} pela ${periodoAlt}`;
            }).join('\n');
          }

          // Mensagem de sugestão mais direta e humanizada
          let sugestaoTexto = `Ok, para a OS ${user.osEscolhida.id} (${assunto}), tenho uma sugestão: ${diaSemana}, ${dataFormatada}, no período da ${periodoExtenso}.`;
          if (alternativas) {
            sugestaoTexto += `\n\nTenho também estas outras datas:\n${alternativas}`;
          }
          sugestaoTexto += '\n\nFica bom pra você ou prefere outra data?';
          resposta = sugestaoTexto;
          break;
        }
        case 'datas_disponiveis': {
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }
          const respostaObj = { get resposta() { return resposta; }, set resposta(value) { resposta = value; } };
          if (!validarOSEscolhida(user, respostaObj)) {
            break;
          }

          // Se a OS já está agendada, informa e oferece opções
          if (user.osEscolhida.status === 'AG') {
            const dataAgendada = user.osEscolhida.data_agenda_final ? 
              dayjs(user.osEscolhida.data_agenda_final).format('DD/MM/YYYY') : 'data não definida';
            const periodoAgendado = user.osEscolhida.melhor_horario_agenda === 'M' ? 'manhã' : 'tarde';
            const diaSemanaAgendado = user.osEscolhida.data_agenda_final ? 
              diaDaSemanaExtenso(user.osEscolhida.data_agenda_final) : '';
            const assunto = formatarDescricaoOS(user.osEscolhida);
            
            resposta = `Você selecionou a OS ${user.osEscolhida.id} (${assunto}) que já está agendada para ${diaSemanaAgendado}, ` +
                      `dia ${dataAgendada}, no período da ${periodoAgendado}.\n\n` +
                      `O que você gostaria de fazer?\n` +
                      `1. Ver mais detalhes desta OS\n` +
                      `2. Reagendar esta visita\n` +
                      `3. Voltar para a lista de OS`;
            break;
          }

          // Buscar sugestões de agendamento usando a OS completa
          const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida);
          user.sugestoesAgendamento = sugestoes;

          if (!sugestoes || !sugestoes.sugestao) {
            resposta = tratarIndisponibilidadeAgendamento(user);
            break;
          }

          // Formatar mensagem amigável com sugestão principal e até 3 alternativas
          const dataSug = sugestoes.sugestao.data;
          const periodoSug = sugestoes.sugestao.periodo;

          // Armazenar a sugestão principal para uso na confirmação
          user.sugestaoData = dataSug;
          user.sugestaoPeriodo = periodoSug;
          console.log(`[DEBUG] Sugestão principal armazenada para confirmação: Data=${user.sugestaoData}, Período=${user.sugestaoPeriodo}`);

          const dataFormatada = dayjs(dataSug).format('DD/MM/YYYY');
          const diaSemana = diaDaSemanaExtenso(dataSug);
          const periodoExtenso = periodoSug === 'M' ? 'manhã' : 'tarde';
          const assunto = formatarDescricaoOS(user.osEscolhida);

          // Alternativas
          let alternativas = '';
          if (sugestoes.alternativas && sugestoes.alternativas.length > 0) {
            // Filtra a sugestão principal para não aparecer nas alternativas
            const principalKey = `${sugestoes.sugestao.data}-${sugestoes.sugestao.periodo}`;
            
            // Agrupa alternativas por data/periodo, evita duplicidade
            const alternativasUnicas = [];
            
            for (const alt of sugestoes.alternativas) {
              if (!alternativasUnicas.some(a => a.data === alt.data && a.periodo === alt.periodo)) {
                alternativasUnicas.push(alt);
              }
              if (alternativasUnicas.length >= 3) break;
            }
            
            alternativas = alternativasUnicas.map(alt => {
              const dataAlt = dayjs(alt.data).format('DD/MM/YYYY');
              const diaAlt = diaDaSemanaExtenso(alt.data);
              const periodoAlt = alt.periodo === 'M' ? 'manhã' : 'tarde';
              return `• ${diaAlt}, ${dataAlt} pela ${periodoAlt}`;
            }).join('\n');
          }

          resposta = `Ótimo! Tenho uma sugestão para sua visita de ${assunto}! ` +
            `Que tal ${diaSemana}, dia ${dataFormatada}, no período da ${periodoExtenso}? ` +
            (alternativas ? `\n\nSe preferir, também tenho:\n${alternativas}` : '') +
            `\n\nEstá bom para você ou prefere outra opção? Se preferir, posso verificar outras datas disponíveis.`;
          break;
        }
        case 'extrair_data': {
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }
          // OS is needed for `verificarDisponibilidade` later in this case.
          const respostaObj = { get resposta() { return resposta; }, set resposta(value) { resposta = value; } };
          if (!validarOSEscolhida(user, respostaObj)) {
            break;
          }
          // At this point, user.osEscolhida should be set.

          const interpretacao = await interpretaDataePeriodo({
            mensagem,
            agentId: 'agent_os',
            dados: contexto,
            promptExtra: 'Tentando extrair data e período da mensagem do usuário.'
          });

          console.log('Resultado interpretaDataePeriodo:', interpretacao);

          if (!interpretacao || !interpretacao.data_interpretada || !dayjs(interpretacao.data_interpretada).isValid()) {
            // Se não conseguiu interpretar a data, ou a data é inválida, pede para o usuário informar novamente.
            // Isso evita o loop onde o período é repetido, mas a data não é capturada.
            resposta = 'Não consegui entender a data informada. Por favor, poderia tentar novamente? Você pode usar "hoje", "amanhã" ou o dia do mês, como "dia 28".';
            // user.etapaAtual = 'extrair_data'; // Mantém o usuário na mesma etapa.
            break;
          }

          user.dataInterpretada = interpretacao.data_interpretada;
          user.periodoAgendamento = interpretacao.periodo_interpretado; // Pode ser null se não encontrado

          // Verificar validade da data e disponibilidade
          if (user.osEscolhida) {
            const resultadoDisponibilidade = await verificarDisponibilidadeData(
              user.osEscolhida,
              {
                data: user.dataInterpretada,
                periodo: user.periodoAgendamento // pode ser null
              }
            );

            if (!resultadoDisponibilidade.disponivel) {
              const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
              let motivoIndisponibilidade = `não temos disponibilidade para ${dataFormatada}`;
              if(user.periodoAgendamento) {
                  const periodoTexto = user.periodoAgendamento === 'M' ? 'manhã' : 'tarde';
                  motivoIndisponibilidade += ` no período da ${periodoTexto}`;
              }
              
              if (resultadoDisponibilidade.motivo === 'Não é um dia útil') {
                  motivoIndisponibilidade = `a data ${dataFormatada} não é um dia útil`;
              }

              // Tentar gerar sugestões alternativas
              const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida);
              
              if (sugestoes && sugestoes.sugestao) {
                const sugestaoData = dayjs(sugestoes.sugestao.data).format('DD/MM/YYYY');
                const sugestaoDiaSemana = diaDaSemanaExtenso(sugestoes.sugestao.data);
                const sugestaoPeriodo = sugestoes.sugestao.periodo === 'M' ? 'manhã' : 'tarde';
                
                resposta = `Infelizmente, ${motivoIndisponibilidade}. Mas tenho uma sugestão: ${sugestaoDiaSemana}, ${sugestaoData}, no período da ${sugestaoPeriodo}. Essa data funciona para você?`;
                
                user.sugestaoData = sugestoes.sugestao.data;
                user.sugestaoPeriodo = sugestoes.sugestao.periodo;
                user.id_tecnico = sugestoes.sugestao.id_tecnico;
                user.aguardandoConfirmacao = true;
                user.tipoUltimaPergunta = 'AGENDAMENTO_SUGESTAO';
                // user.etapaAtual = 'confirmar_agendamento';
              } else {
                resposta = tratarIndisponibilidadeAgendamento(user);
                user.dataInterpretada = null;
                user.periodoAgendamento = null;
                // user.etapaAtual = 'extrair_data';
              }
              break;
            }
            
            // Se chegou aqui, a data é disponível.
            // Se o período não foi especificado, precisamos informar os períodos disponíveis.
            if (!user.periodoAgendamento && resultadoDisponibilidade.periodosDisponiveis && resultadoDisponibilidade.periodosDisponiveis.length > 0) {
                const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
                const periodosTexto = resultadoDisponibilidade.periodosDisponiveis.map(p => p === 'M' ? 'manhã' : 'tarde').join(' e ');
                resposta = `Para o dia ${dataFormatada}, temos disponibilidade no período da ${periodosTexto}. Qual você prefere?`;
                // user.etapaAtual = 'extrair_hora'; // Pede para o usuário escolher o período
                break;
            }
          } else {
            // Verificação de final de semana genérica se não houver OS (improvável neste ponto do fluxo)
            const diaDaSemana = dayjs(user.dataInterpretada).day();
            if (diaDaSemana === 0 || diaDaSemana === 6) {
              const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
              const diaSemanaTexto = diaDaSemana === 0 ? 'domingo' : 'sábado';
              resposta = `Desculpe, não realizamos agendamentos para finais de semana. A data ${dataFormatada} é um ${diaSemanaTexto}. Por favor, escolha uma data de segunda a sexta-feira.`;
              user.dataInterpretada = null;
              user.periodoAgendamento = null;
              break;
            }
          }

          // Se temos data E período
          if (user.dataInterpretada && user.periodoAgendamento) {
            try {
              if (!user.osEscolhida && user.osList.length === 1) {
                user.osEscolhida = user.osList[0];
              }

              if (user.osEscolhida) {
                // A disponibilidade já foi verificada no bloco anterior.
                // Se chegamos aqui, a data e período são válidos e disponíveis.
                const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
                const diaSemana = diaDaSemanaExtenso(user.dataInterpretada);
                const periodoExtenso = user.periodoAgendamento === 'M' ? 'manhã' : 'tarde';
                const assunto = formatarDescricaoOS(user.osEscolhida);

                // Mensagem mais natural e direta, evitando repetição
                resposta = `Perfeito! Então podemos confirmar para ${diaSemana}, ${dataFormatada}, no período da ${periodoExtenso}?`;
                
                // Gerar sugestão para obter o id_tecnico correto para a data/período escolhida
                const sugestaoEspecifica = await gerarSugestoesDeAgendamento(user.osEscolhida, {
                  dataEspecifica: user.dataInterpretada,
                  periodoEspecifico: user.periodoAgendamento
                });
                
                user.sugestaoData = user.dataInterpretada;
                user.sugestaoPeriodo = user.periodoAgendamento;
                user.id_tecnico = sugestaoEspecifica?.sugestao?.id_tecnico || null;
                user.tipoUltimaPergunta = 'AGENDAMENTO';
                user.aguardandoConfirmacao = true;
                // user.etapaAtual = 'confirmar_agendamento';
              } else {
                // Fallback case
                resposta = `Entendi que o agendamento seria para ${dayjs(user.dataInterpretada).format('DD/MM/YYYY')} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}. Para qual OS seria?`;
                // user.etapaAtual = 'escolher_os';
              }
            } catch (error) {
              console.error('Erro ao preparar a confirmação do agendamento:', error);
              resposta = 'Desculpe, ocorreu um erro ao preparar a confirmação do agendamento. Por favor, tente novamente mais tarde.';
            }
          } else if (user.dataInterpretada && !user.periodoAgendamento) {
            // Temos data, mas FALTA período
            const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
            resposta = await gerarMensagemDaIntent({
              intent: 'extrair_hora', // Mudar para intent de pedir período
              agentId: 'agent_os',
              dados: contexto,
              promptExtra: 'Ok, anotei a data ${dataFormatada}. Você prefere o período da manhã ou da tarde?'
            });
            // user.etapaAtual = 'extrair_hora';
          } else {
            // Cenário inesperado ou dados insuficientes após a primeira tentativa de interpretação
             resposta = "Não consegui entender completamente sua solicitação de data e período. Pode tentar novamente, por favor? Exemplo: 'quero agendar para amanhã à tarde'.";
          }
          break;
        }
        case 'extrair_hora': {
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }
          // OS is needed for `verificarDisponibilidade` later.
          const respostaObj = { get resposta() { return resposta; }, set resposta(value) { resposta = value; } };
          if (!validarOSEscolhida(user, respostaObj, 'Por favor, me informe para qual Ordem de Serviço você gostaria de agendar.')) {
            break;
          }
          // At this point, user.osEscolhida should be set.

          // Primeiro, tentar extrair data e período juntos da mensagem
          const interpretacaoCompleta = await interpretaDataePeriodo({ mensagem, agentId: 'agent_os', dados: contexto });
          
          let periodoInterp = null;
          let dataExtraida = null;
          
          // Se conseguiu extrair data e período juntos
          if (interpretacaoCompleta && interpretacaoCompleta.data_interpretada) {
            dataExtraida = interpretacaoCompleta.data_interpretada;
            periodoInterp = interpretacaoCompleta.periodo_interpretado;
            console.log('Extraído data e período juntos:', { data: dataExtraida, periodo: periodoInterp });
          } else {
            // Fallback: tentar extrair apenas o período
            periodoInterp = await interpretaPeriodo(mensagem);
            console.log('Extraído apenas período:', periodoInterp);
          }
          
          // Se um período válido (M/T) foi interpretado
          if (periodoInterp && ['M', 'T'].includes(periodoInterp)) {
            user.periodoAgendamento = periodoInterp;
          }

          // Se extraiu data junto com o período, usar a data extraída
          if (dataExtraida) {
            user.dataInterpretada = dataExtraida;
          }
          
          // Se não conseguiu extrair período válido
          if (!periodoInterp || !['M', 'T'].includes(periodoInterp)) {
            resposta = await gerarMensagemDaIntent({
              intent: 'faltando_hora', // Mudar para intent de pedir período
              agentId: 'agent_os',
              dados: contexto,
              promptExtra: 'Não consegui identificar o período. Por favor, diga se prefere manhã ou tarde.'
            });
            break;
          }
          // Restante do código para extrair_hora
          // ...
          // Agora verificar se temos data na sessão ou extraída
          if (!user.dataInterpretada) {
            // Se não temos data, mas temos período, pedir a data
            const periodoExtensoUser = user.periodoAgendamento === 'M' ? 'manhã' : 'tarde';
            resposta = `Entendi que você prefere o período da ${periodoExtensoUser}. Para qual data seria o agendamento?`;
            // user.etapaAtual = 'extrair_data';
            break;
          }

          // Se temos data e período, verificar disponibilidade
          if (user.dataInterpretada && user.periodoAgendamento) {
            if (user.osEscolhida) {
              try {
                const resultadoDisponibilidade = await verificarDisponibilidadeData(
                  user.osEscolhida,
                  {
                    data: user.dataInterpretada,
                    periodo: user.periodoAgendamento
                  }
                );

                if (resultadoDisponibilidade.disponivel) {
                  const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
                  const diaSemana = diaDaSemanaExtenso(user.dataInterpretada);
                  const periodoExtenso = user.periodoAgendamento === 'M' ? 'manhã' : 'tarde';
                  const assunto = formatarDescricaoOS(user.osEscolhida);
                  
                  resposta = `Confirma o agendamento para ${diaSemana}, ${dataFormatada} pela ${periodoExtenso} para OS ${user.osEscolhida.id} (${assunto})?`;
                  user.sugestaoData = user.dataInterpretada;
                  user.sugestaoPeriodo = user.periodoAgendamento;
                  user.tipoUltimaPergunta = 'AGENDAMENTO';
                  user.aguardandoConfirmacao = true;
                  // user.etapaAtual = 'confirmar_agendamento';
                } else {
                  // Não disponível, gerar sugestões
                  const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
                  const periodoTexto = user.periodoAgendamento === 'M' ? 'manhã' : 'tarde';
                  let motivoIndisponibilidade = `não temos disponibilidade para ${dataFormatada} no período da ${periodoTexto}`;
                  if (resultadoDisponibilidade.motivo === 'Não é um dia útil') {
                      motivoIndisponibilidade = `a data ${dataFormatada} não é um dia útil`;
                  }

                  const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida);

                  if (sugestoes && sugestoes.sugestao) {
                      const { data, periodo } = sugestoes.sugestao;
                      const dataFormatadaSugestao = dayjs(data).format('DD/MM/YYYY');
                      const periodoExtensoSugestao = periodo === 'M' ? 'manhã' : 'tarde';
                      const diaSemanaSugestao = diaDaSemanaExtenso(data);

                      resposta = `Infelizmente, ${motivoIndisponibilidade}. A próxima data disponível que encontrei é ${diaSemanaSugestao}, ${dataFormatadaSugestao}, no período da ${periodoExtensoSugestao}. Podemos agendar para essa data?`;
                      
                      user.sugestaoData = data;
                      user.sugestaoPeriodo = periodo;
                      user.tipoUltimaPergunta = 'AGENDAMENTO_SUGESTAO';
                      user.aguardandoConfirmacao = true;
                      // user.etapaAtual = 'confirmar_agendamento';
                  } else {
                      resposta = `Desculpe, ${motivoIndisponibilidade} e não consegui gerar uma sugestão. Gostaria de tentar outra data ou período?`;
                  }
                  break; // Sair após dar a sugestão ou a mensagem de erro.
                }
              } catch (error) {
                console.error('Erro ao verificar disponibilidade em extrair_hora:', error);
                resposta = 'Desculpe, ocorreu um erro ao verificar a disponibilidade. Por favor, tente novamente mais tarde.';
              }
            } else {
              resposta = `Entendi que o agendamento seria para ${dayjs(user.dataInterpretada).format('DD/MM/YYYY')} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}. Para qual OS seria?`;
              // user.etapaAtual = 'escolher_os';
            }
          }
          break;
        }
        case 'alterar_periodo': {
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }
          const respostaObj = { get resposta() { return resposta; }, set resposta(value) { resposta = value; } };
          if (!validarOSEscolhida(user, respostaObj, 'Por favor, me informe para qual Ordem de Serviço você gostaria de alterar o período.')) {
            break;
          }
          // The call to verificarOSEscolhida is now redundant.
          
          // Extrair o período da mensagem (manhã ou tarde)
          const periodoInterp = await interpretaPeriodo(mensagem);
          console.log(`Período interpretado da mensagem: ${periodoInterp}`);
          
          if (!periodoInterp || !['M', 'T'].includes(periodoInterp)) {
            resposta = 'Não consegui identificar o período que você deseja. Por favor, especifique se prefere pela manhã ou pela tarde.';
            break;
          }

          // Manter a data atual, mas alterar o período
          user.periodoAgendamento = periodoInterp;
          
          // Se não tiver data interpretada, usar a data da sugestão
          if (!user.dataInterpretada && user.sugestaoData) {
            user.dataInterpretada = user.sugestaoData;
            console.log(`Usando data da sugestão: ${user.dataInterpretada} com o novo período: ${periodoInterp}`);
          }

          if (!user.dataInterpretada) {
            resposta = 'Precisamos de uma data para o agendamento. Pode me informar qual data você prefere?';
            break;
          }

          // Verificar a disponibilidade para o período solicitado
          const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida, {
            dataEspecifica: user.dataInterpretada,
            periodoEspecifico: periodoInterp
          });

          if (!sugestoes || !sugestoes.sugestao) {
            resposta = `Desculpe, não encontrei disponibilidade para ${dayjs(user.dataInterpretada).format('DD/MM/YYYY')} no período da ${periodoInterp === 'M' ? 'manhã' : 'tarde'}. Gostaria de tentar outra data ou período?`;
            break;
          }

          // Formatar a data e o período para a mensagem usando os valores escolhidos pelo usuário
          const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
          const diaSemana = diaDaSemanaExtenso(user.dataInterpretada);
          const periodoExtenso = user.periodoAgendamento === 'M' ? 'manhã' : 'tarde';
          const assunto = formatarDescricaoOS(user.osEscolhida);
          
          resposta = `Ótimo! Confirmando a alteração para ${diaSemana}, dia ${dataFormatada}, no período da ${periodoExtenso}. Posso confirmar o agendamento?`;
          break;
        }
        case 'agendar_data': {
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }
          
          // Tentar extrair número da OS da mensagem do usuário se não há OS selecionada
          if (!user.osEscolhida) {
            const numeroOSMencionado = await interpretarNumeroOS({ mensagem: mensagem, osList: user.osList });
            if (numeroOSMencionado && user.osList) {
              const osEncontrada = user.osList.find(os => os.id == numeroOSMencionado);
              if (osEncontrada) {
                console.log(`[DEBUG] agendar_data: OS ${numeroOSMencionado} detectada automaticamente na mensagem`);
                user.osEscolhida = osEncontrada;
              } else {
                console.log(`[DEBUG] agendar_data: OS ${numeroOSMencionado} mencionada não encontrada na lista do cliente`);
              }
            }
          }
          
          const respostaObj = { get resposta() { return resposta; }, set resposta(value) { resposta = value; } };
          if (!validarOSEscolhida(user, respostaObj)) {
            break;
          }

          if (user.osEscolhida) { 
            const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida);
            user.sugestoesAgendamento = sugestoes;

            if (!sugestoes || !sugestoes.sugestao) {
              resposta = tratarIndisponibilidadeAgendamento(user);
              break;
            }

            // Formatar mensagem com sugestão principal e até 3 alternativas
            const dataSug = sugestoes.sugestao.data;
            const periodoSug = sugestoes.sugestao.periodo;

            // Armazenar a sugestão principal e atualizar o estado da conversa
            user.sugestaoData = dataSug;
            user.sugestaoPeriodo = periodoSug;
            user.id_tecnico = sugestoes.sugestao.id_tecnico; // Armazena o técnico da sugestão
            user.etapaAnterior = user.etapaAtual;
            user.etapaAtual = 'aguardando_confirmacao_agendamento';
            user.tipoUltimaPergunta = 'AGENDAMENTO_SUGESTAO';
            console.log(`[DEBUG] Sugestão principal armazenada e etapa atualizada para 'aguardando_confirmacao_agendamento'`);

            const dataFormatada = dayjs(dataSug).format('DD/MM/YYYY');
            const diaSemana = diaDaSemanaExtenso(dataSug);
            const periodoExtenso = periodoSug === 'M' ? 'manhã' : 'tarde';
            const assunto = formatarDescricaoOS(user.osEscolhida);
            
            resposta = `${diaSemana}, ${dataFormatada} pela ${periodoExtenso} está disponível para agendamento da OS ${user.osEscolhida.id} (${assunto}). Está bom para você ou prefere outra opção? Se preferir, posso verificar outras datas disponíveis.`;
            console.log(`[LOG] 💬 Resposta construída no case 'escolher_os': ${resposta}`);

            // Alternativas
            let alternativas = '';
            if (sugestoes.alternativas && sugestoes.alternativas.length > 0) {
              // Agrupa alternativas por data/periodo, evita duplicidade
              const alternativasUnicas = [];
              const seen = new Set([`${sugestoes.sugestao.data},${sugestoes.sugestao.periodo}`]); // Inicializa o Set com a sugestão principal para evitar duplicação
              
              for (const alt of sugestoes.alternativas) {
                if (!alternativasUnicas.some(a => a.data === alt.data && a.periodo === alt.periodo)) {
                  alternativasUnicas.push(alt);
                }
                if (alternativasUnicas.length >= 3) break;
              }
              
              alternativas = alternativasUnicas.map(alt => {
                const dataAlt = dayjs(alt.data).format('DD/MM/YYYY');
                const diaAlt = diaDaSemanaExtenso(alt.data);
                const periodoAlt = alt.periodo === 'M' ? 'manhã' : 'tarde';
                return `• ${diaAlt}, ${dataAlt} pela ${periodoAlt}`;
              }).join('\n');
            }

            resposta = `${diaSemana}, ${dataFormatada} pela ${periodoExtenso} está disponível para agendamento da OS ${user.osEscolhida.id} (${assunto}). ` +
              `Está bom para você ou prefere outra opção? Se preferir, posso verificar outras datas disponíveis.`;
          } else {
            // Fluxo antigo se não houver OS escolhida (deve ser raro)
            if (!user.osEscolhida || !user.dataInterpretada || !user.periodoAgendamento) {
              resposta = await gerarMensagemDaIntent({
                intent,
                agentId: 'agent_os',
                dados: contexto,
                promptExtra: 'Faltam OS, data ou período para agendar.'
              });
              break;
            }

            user.aguardandoConfirmacao = true;
            resposta = `Confirma agendar a OS ${user.osEscolhida.id} para ${dayjs(user.dataInterpretada).format('DD/MM/YYYY')} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}?`;
          }
          break;
        }
        case 'agendar_outra_data': {
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }
          const respostaObj = { get resposta() { return resposta; }, set resposta(value) { resposta = value; } };
          if (!validarOSEscolhida(user, respostaObj)) {
            break;
          }
          if (!!user.dataInterpretada || !!user.periodoAgendamento) {
            user.periodoAgendamento = null; // Limpa o período anterior
            user.dataInterpretada = null; // Limpa a data anterior
          }
          
          // This case implies the user wants to provide a new date/time.
          resposta = await gerarMensagemDaIntent({
            intent: 'extrair_data', // Transition to a state that expects date input
            agentId: 'agent_os',
            dados: contexto,
            promptExtra: `Entendido. Para qual nova data e período (manhã ou tarde) você gostaria de reagendar a OS ${user.osEscolhida.id}?`
          });
          // user.etapaAtual = 'extrair_data'; // Set the conversation to expect a date next.
          break;
        }

        case 'consultar_disponibilidade_data': {
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }
          const respostaObj = { get resposta() { return resposta; }, set resposta(value) { resposta = value; } };
          if (!validarOSEscolhida(user, respostaObj, 'Ops! Parece que ainda não selecionamos uma OS. Pode me dizer para qual ordem de serviço você gostaria de consultar a disponibilidade?')) {
            break;
          }
          
          const dataInterp = await interpretarDataNatural(mensagem, 'agent_os', contexto, 'Frase do usuário: "' + mensagem + '"');
          console.log('====== DATA SOLICITADA PARA VERIFICAÇÃO: ======');
          console.log(dataInterp);
          console.log('===============================');
          
          // Se não encontrou data válida, informa ao usuário
          if (!dataInterp || !dayjs(dataInterp).isValid()) {
            resposta = "Desculpe, não consegui entender a data solicitada. Pode me dizer novamente de outra forma, por exemplo: 'dia 25/12' ou 'próxima segunda-feira'?";
            break;
          }
          
          // Interpretar o período da mensagem (manhã ou tarde)
          const periodoInterp = await interpretaPeriodo(mensagem);
          const periodoSolicitado = periodoInterp || null; // Se não especificou, consideramos qualquer período
          
          // Obter as sugestões de agendamento para a OS escolhida
          const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida);
          user.sugestoesAgendamento = sugestoes;
          
          // Se não há sugestões disponíveis
          if (!sugestoes || !sugestoes.alternativas || sugestoes.alternativas.length === 0) {
            resposta = "Desculpe, não foi possível verificar a disponibilidade para esta data. Vamos tentar outra abordagem?";
            break;
          }
          
          // Verificar se a data solicitada está entre as alternativas disponíveis
          const dataSolicitada = dayjs(dataInterp).format('YYYY-MM-DD');
          let datasDisponiveis = [];
          let disponibilidadeEncontrada = false;
          let alternativasNaData = [];
          
          // Verifica todas as alternativas para encontrar a data solicitada
          sugestoes.alternativas.forEach(alternativa => {
            // Adicionar todas as datas únicas disponíveis para apresentar ao usuário caso necessário
            if (!datasDisponiveis.includes(alternativa.data)) {
              datasDisponiveis.push(alternativa.data);
            }
            
            // Verifica se encontramos a data solicitada
            if (alternativa.data === dataSolicitada) {
              disponibilidadeEncontrada = true;
              alternativasNaData.push(alternativa);
            }
          });
          
          // Se a data solicitada não está disponível
          if (!disponibilidadeEncontrada) {
            // Formatar as datas disponíveis para apresentar ao usuário
            const datasFormatadas = datasDisponiveis.map(data => {
              const dataObj = dayjs(data);
              const diaSemana = diaDaSemanaExtenso(dataObj);
              return `${diaSemana}, ${dataObj.format('DD/MM/YYYY')}`;
            }).slice(0, 5); // Mostrar apenas as 5 primeiras opções
            
            resposta = `Desculpe, o dia ${dayjs(dataSolicitada).format('DD/MM/YYYY')} não está disponível para agendamento. ` +
              `Posso oferecer as seguintes datas:\n\n• ${datasFormatadas.join('\n• ')}\n\nQual dessas opções seria melhor para você?`;
            break;
          }
          
          // Verificar disponibilidade para o período solicitado
          const alternativasNoPeriodo = periodoSolicitado ? 
            alternativasNaData.filter(alt => alt.periodo === periodoSolicitado) : 
            alternativasNaData;
          
          // Se não há disponibilidade no período solicitado, mas há em outro
          if (periodoSolicitado && alternativasNoPeriodo.length === 0 && alternativasNaData.length > 0) {
            const outroPeriodo = periodoSolicitado === 'M' ? 'tarde' : 'manhã';
            resposta = `Encontrei disponibilidade para o dia ${dayjs(dataSolicitada).format('DD/MM/YYYY')}, mas apenas no período da ${outroPeriodo}. ` +
              `Esse horário seria bom para você?`;
            
            // Atualiza informações da sessão para facilitar confirmação
            user.dataInterpretada = dataSolicitada;
            user.periodoAgendamento = periodoSolicitado === 'M' ? 'T' : 'M';
          } 
          // Se há disponibilidade no período solicitado
          else if (alternativasNoPeriodo.length > 0) {
            const periodoExtenso = periodoSolicitado === 'M' ? 'manhã' : 'tarde';
            const dataObj = dayjs(dataSolicitada);
            const diaSemana = diaDaSemanaExtenso(dataObj);
            
            resposta = `Ótimo! Temos disponibilidade para ${diaSemana}, dia ${dataObj.format('DD/MM/YYYY')}, no período da ${periodoExtenso}. ` +
              `Posso confirmar esse agendamento para você?`;
            
            // Atualiza informações da sessão para facilitar confirmação
            user.dataInterpretada = dataSolicitada;
            user.periodoAgendamento = periodoSolicitado;
          }
          // Se encontrou a data, mas nenhum período foi especificado
          else {
            const periodosDisponiveis = alternativasNaData.map(alt => alt.periodo === 'M' ? 'manhã' : 'tarde');
            const dataObj = dayjs(dataSolicitada);
            const diaSemana = diaDaSemanaExtenso(dataObj);
            
            resposta = `Encontrei disponibilidade para ${diaSemana}, dia ${dataObj.format('DD/MM/YYYY')}, nos seguintes períodos: ` +
              `${periodosDisponiveis.join(' e ')}. Qual período você prefere?`;
          }
          break;
        }      
        case 'confirmar_agendamento': {
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }
          const respostaObj = { get resposta() { return resposta; }, set resposta(value) { resposta = value; } };
          if (!validarOSEscolhida(user, respostaObj)) {
            break;
          }
          // Estratégia para determinar data/período do agendamento:
          // 1. Usar valores atuais de user se existirem (para preservar o estado da conversa)
          // 2. Caso contrário, tentar extrair da mensagem de confirmação atual
          // 3. Se ainda faltar, usar valores de sugestão anterior (se houver uma sugestão pendente)
          
          // 1. Inicializar com os valores atuais do usuário (se existirem)
          let dataConfirmacao = user.dataInterpretada || null;
          console.log('[DEBUG] confirmar_agendamento: Data confirmada:', dataConfirmacao);
          let periodoConfirmacao = user.periodoAgendamento || null;
          console.log('[DEBUG] confirmar_agendamento: Período confirmado:', periodoConfirmacao);
          
          // Gerar sugestões de agendamento para esta OS
          console.log('[DEBUG] confirmar_agendamento: Gerando sugestões de agendamento para a OS:', user.osEscolhida.id);
          const { sugestao, alternativas } = await gerarSugestoesDeAgendamento(user.osEscolhida);
          console.log('[DEBUG] confirmar_agendamento: Sugestões geradas:', sugestao, alternativas);
          user.sugestoesAgendamento = { sugestao, alternativas };
          
          // Armazenar a sugestão principal para uso na confirmação (consistente com o resto do código)
          if (sugestao) {
            user.sugestaoData = sugestao.data;
            user.sugestaoPeriodo = sugestao.periodo;
            user.id_tecnico = sugestao.id_tecnico; // CORRIGIDO: Armazenar ID do técnico
            user.tipoUltimaPergunta = 'AGENDAMENTO_SUGESTAO';
            console.log(`[DEBUG] Sugestão principal armazenada para confirmação: Data=${user.sugestaoData}, Período=${user.sugestaoPeriodo}, Técnico=${user.id_tecnico}`);
            console.log(`[DEBUG] VERIFICANDO: user.id_tecnico após atribuição = '${user.id_tecnico}' (tipo: ${typeof user.id_tecnico})`);
          }
          
          // Log do estado inicial
          console.log('[DEBUG] confirmar_agendamento: Estado inicial - Data:', dataConfirmacao, 'Período:', periodoConfirmacao);
          
          // 2. Se não temos data E período, tentar extrair da mensagem atual
          if (!dataConfirmacao || !periodoConfirmacao) {
            console.log('[DEBUG] confirmar_agendamento: Tentando extrair data/período da mensagem:', mensagem);
            const interpretadoDaMensagem = await interpretaDataePeriodo({
              mensagem,
              agentId: 'agent_os',
              dados: contexto,
              promptExtra: 'Tente identificar data e/ou período para o agendamento na mensagem de confirmação.'
            });

            if (interpretadoDaMensagem) {
              // Só atualiza valores que estejam faltando
              if (!dataConfirmacao && interpretadoDaMensagem.data_interpretada && 
                  dayjs(interpretadoDaMensagem.data_interpretada).isValid()) {
                dataConfirmacao = interpretadoDaMensagem.data_interpretada;
                console.log('[DEBUG] confirmar_agendamento: Data extraída da mensagem:', dataConfirmacao);
              }
              
              if (!periodoConfirmacao && interpretadoDaMensagem.periodo_interpretado) {
                periodoConfirmacao = interpretadoDaMensagem.periodo_interpretado;
                console.log('[DEBUG] confirmar_agendamento: Período extraído da mensagem:', periodoConfirmacao);
              }
            }
            
            // 3. Verificar se há uma sugestão pendente (apenas se ainda faltar algum dado)
            if ((!dataConfirmacao || !periodoConfirmacao) && 
                user.tipoUltimaPergunta === 'AGENDAMENTO_SUGESTAO' && 
                user.sugestaoData && user.sugestaoPeriodo) {
              
              console.log('[DEBUG] confirmar_agendamento: Verificando sugestão pendente');
              
              if (!dataConfirmacao && user.sugestaoData && dayjs(user.sugestaoData).isValid()) {
                dataConfirmacao = user.sugestaoData;
                console.log('[DEBUG] confirmar_agendamento: Usando data da sugestão:', dataConfirmacao);
              }
              
              if (!periodoConfirmacao && user.sugestaoPeriodo) {
                periodoConfirmacao = user.sugestaoPeriodo;
                console.log('[DEBUG] confirmar_agendamento: Usando período da sugestão:', periodoConfirmacao);
              }
            }
          }
          
          // Atualizar o estado do usuário com os valores determinados
          user.dataInterpretada = dataConfirmacao;
          user.periodoAgendamento = periodoConfirmacao;
          console.log(`[DEBUG] confirmar_agendamento: Valores finais - Data: ${dataConfirmacao}, Período: ${periodoConfirmacao}`);
          
          // CRÍTICO: Se o usuário forneceu data/período específica (diferente da sugestão), 
          // precisamos gerar uma nova sugestão para obter o id_tecnico correto
          console.log(`[DEBUG] Comparando: dataConfirmacao='${dataConfirmacao}' vs user.sugestaoData='${user.sugestaoData}'`);
          console.log(`[DEBUG] Comparando: periodoConfirmacao='${periodoConfirmacao}' vs user.sugestaoPeriodo='${user.sugestaoPeriodo}'`);
          
          if (dataConfirmacao && periodoConfirmacao && 
              (String(dataConfirmacao) !== String(user.sugestaoData) || String(periodoConfirmacao) !== String(user.sugestaoPeriodo))) {
            console.log('[DEBUG] confirmar_agendamento: Data/período específica fornecida, gerando sugestão para obter técnico correto');
            try {
              const sugestaoEspecifica = await gerarSugestoesDeAgendamento(user.osEscolhida, {
                dataEspecifica: dataConfirmacao,
                periodoEspecifico: periodoConfirmacao
              });
              
              if (sugestaoEspecifica?.sugestao?.id_tecnico) {
                user.sugestaoData = dataConfirmacao;
                user.sugestaoPeriodo = periodoConfirmacao;
                user.id_tecnico = sugestaoEspecifica.sugestao.id_tecnico;
                console.log(`[DEBUG] confirmar_agendamento: Técnico atualizado para data/período específica: ${user.id_tecnico}`);
              } else {
                console.log('[DEBUG] confirmar_agendamento: Não foi possível obter técnico para data/período específica');
                user.id_tecnico = null;
              }
            } catch (error) {
              console.error('[DEBUG] confirmar_agendamento: Erro ao gerar sugestão específica:', error);
              user.id_tecnico = null;
            }
          }
          
          // Verificar se temos informações suficientes para prosseguir
          if (!dataConfirmacao && !periodoConfirmacao) {
            resposta = 'Preciso que você me informe a data e o período para agendarmos.';
            break;
          } else if (!dataConfirmacao) {
            resposta = 'Qual data você prefere para o agendamento?';
            break;
          } else if (!periodoConfirmacao) {
            resposta = `Para o dia ${dayjs(dataConfirmacao).format('DD/MM/YYYY')}, você prefere manhã ou tarde?`;
            break;
          }
          
          // Verificar se estamos esperando confirmação ou se o usuário já confirmou
          if (!user.aguardandoConfirmacao) {
            // Se não estamos aguardando confirmação, perguntar ao usuário para confirmar
            const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
            const diaSemana = diaDaSemanaExtenso(user.dataInterpretada);
            const periodoExtenso = user.periodoAgendamento === 'M' ? 'manhã' : 'tarde';
            const assunto = formatarDescricaoOS(user.osEscolhida);
            
            resposta = `Só para confirmar: posso agendar para ${diaSemana}, ${dataFormatada}, no período da ${periodoExtenso}, para a OS ${user.osEscolhida.id} (${assunto})?`;
            
            user.aguardandoConfirmacao = true;
            break;
          }
          
          // Se passou aqui, temos tudo: OS + data + período e o usuário confirmou
          // Definir horário padrão com base no período (manhã = 09:00:00, tarde = 14:00:00)
          const horarioPadrao = user.periodoAgendamento === 'M' ? '09:00:00' : '14:00:00';
          const dataAgendamento = `${user.dataInterpretada} ${horarioPadrao}`; // Formato: YYYY-MM-DD HH:MM:SS
          
          // Criar o payload com os dados básicos - a função atualizarOS vai calcular as datas corretas
          console.log(`[DEBUG] CRÍTICO: user.id_tecnico antes do payload = '${user.id_tecnico}' (tipo: ${typeof user.id_tecnico})`);
          const payload = {
           ...user.osEscolhida,
           status: 'AG',
           id_tecnico: user.id_tecnico,
             data_agenda_final: dataAgendamento, // Formato correto: YYYY-MM-DD HH:MM:SS
            melhor_horario_agenda: user.periodoAgendamento // Usar o período escolhido (M ou T)
          };
          
          console.log(`[DEBUG] confirmar_agendamento - INICIANDO AGENDAMENTO:`);
          console.log(`[DEBUG] - OS ID: ${user.osEscolhida.id}`);
          console.log(`[DEBUG] - Data/Hora: ${dataAgendamento}`);
          console.log(`[DEBUG] - Período: ${user.periodoAgendamento}`);
          console.log(`[DEBUG] - Técnico: ${user.id_tecnico}`);
          console.log(`[DEBUG] - Payload completo:`, JSON.stringify(payload, null, 2));

          let resultado;
          try {
            console.log(`[DEBUG] confirmar_agendamento - Chamando atualizarOS...`);
            resultado = await atualizarOS(user.osEscolhida.id, payload);
            console.log(`[DEBUG] confirmar_agendamento - Resultado da atualizarOS:`, JSON.stringify(resultado, null, 2));
            console.log(`[DEBUG] confirmar_agendamento - Tipo do resultado: ${typeof resultado}`);
            console.log(`[DEBUG] confirmar_agendamento - Propriedades do resultado:`, Object.keys(resultado || {}));
          } catch (error) {
            console.error(`[DEBUG] confirmar_agendamento - ERRO CAPTURADO na atualizarOS:`);
            console.error(`[DEBUG] confirmar_agendamento - Erro message: ${error.message}`);
            console.error(`[DEBUG] confirmar_agendamento - Erro status: ${error.response?.status}`);
            console.error(`[DEBUG] confirmar_agendamento - Erro data:`, JSON.stringify(error.response?.data, null, 2));
            console.error(`[DEBUG] confirmar_agendamento - Stack trace:`, error.stack);
            resultado = { type: 'error', message: error.message, originalError: error.response?.data };
          }
          
          console.log(`[DEBUG] confirmar_agendamento - ANALISANDO RESULTADO:`);
          console.log(`[DEBUG] - resultado?.type: ${resultado?.type}`);
          console.log(`[DEBUG] - resultado?.detalhes?.type: ${resultado?.detalhes?.type}`);
          console.log(`[DEBUG] - Estrutura completa:`, JSON.stringify(resultado, null, 2));
          
          // Verificar se houve erro no agendamento
          if (resultado?.detalhes?.type === 'error' || resultado?.type === 'error') {
            console.log(`[DEBUG] confirmar_agendamento - ERRO DETECTADO no agendamento`);
            // Captura o objeto que contém a mensagem de erro (detalhes ou o próprio resultado)
            const errorObject = resultado?.detalhes?.type === 'error' ? resultado.detalhes : resultado;
            const errorMessage = errorObject.message || 'Erro desconhecido';
            
            console.error(`[DEBUG] confirmar_agendamento - Mensagem de erro: ${errorMessage}`);
            console.error(`[DEBUG] confirmar_agendamento - Objeto de erro completo:`, JSON.stringify(errorObject, null, 2));
            
            // Tratar erros comuns de forma amigável
            if (errorMessage.includes('Data de fim deve ser maior')) {
              resposta = `Ops! Tive um probleminha técnico ao agendar sua visita. Estou anotando isso e vou resolver. Por favor, tente novamente daqui a pouco ou entre em contato com nosso suporte.`;
            } else if (errorMessage.includes('colaborador selecionado não está vinculado')) {
              resposta = `Ops! Tive um problema ao agendar: o técnico não está disponível para o tipo de serviço da sua OS. Por favor, entre em contato com o nosso atendimento para que possamos resolver isso.`;
            } else {
              // Criar uma versão limpa da mensagem de erro (removendo tags HTML)
              const cleanError = errorMessage.replace(/<[^>]*>/g, '');
              resposta = `Desculpe, não consegui agendar sua visita neste momento. Erro: ${cleanError}. Por favor, tente novamente mais tarde ou entre em contato com nosso suporte.`;
            }
          } else {
            console.log(`[DEBUG] confirmar_agendamento - SUCESSO DETECTADO no agendamento`);
            console.log(`[DEBUG] - user.osEscolhida existe: ${!!user.osEscolhida}`);
            console.log(`[DEBUG] - user.dataInterpretada: ${user.dataInterpretada}`);
            console.log(`[DEBUG] - user.periodoAgendamento: ${user.periodoAgendamento}`);
            
            if (user.osEscolhida && user.dataInterpretada && user.periodoAgendamento) {
              const assunto = formatarDescricaoOS(user.osEscolhida);
              const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
              const diaSemana = diaDaSemanaExtenso(user.dataInterpretada);
              resposta = `Prontinho! Sua visita para ${assunto} está agendada! Ficou para ${diaSemana}, dia ${dataFormatada} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}. Estou finalizando nosso atendimento. Caso precise de mim, estou por aqui.`;
              console.log(`[DEBUG] confirmar_agendamento - Resposta de sucesso gerada: ${resposta}`);
            } else {
              resposta = `✅ Agendado para ${dayjs(user.dataInterpretada).format('DD/MM/YYYY')} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}.`;
              console.log(`[DEBUG] confirmar_agendamento - Resposta de sucesso simples gerada: ${resposta}`);
            }
          }

          console.log('antes de agendar: LOG ESTADO ');
          /* ----------- LOG COMPLETO DO ESTADO ANTES DE RESPONDER --------- */
          logEstado({ numero, user, intent, resposta });

          // Limpa o estado do agendamento, mas preserva a identidade do cliente para conversas futuras.
          const clienteInfo = {
            cpf: user.cpf,
            clienteId: user.clienteId,
            nomeCliente: user.nomeCliente,
            numero: user.numero,
            osList: user.osList // Preserva a lista de OS já carregada
          };

          // Reseta o objeto user e reatribui a informação do cliente
          Object.keys(user).forEach(key => delete user[key]);
          Object.assign(user, clienteInfo);
          user.tipoUltimaPergunta = 'finalizado'; // Sinaliza que um fluxo foi concluído

          // Recarregar a lista de OS após a limpeza do contexto
          if (user.clienteId) {
            console.log(`Recarregando lista de OS para o cliente ${user.clienteId} após agendamento`);
            try {
              // Recarregar a lista de OS do cliente de forma assíncrona
              buscarOSPorClienteId(user.clienteId)
                .then(osListAtualizada => {
                  if (osListAtualizada && osListAtualizada.length > 0) {
                    user.osList = osListAtualizada;
                    console.log(`Lista de OS recarregada com sucesso após agendamento: ${osListAtualizada.length} OS encontradas`);
                  }
                })
                .catch(error => {
                  console.error('Erro ao recarregar lista de OS após agendamento:', error);
                });
            } catch (error) {
              console.error('Erro ao iniciar recarga da lista de OS após agendamento:', error);
            }
          }
          break;
        }
        case 'mais_detalhes': {
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }
          if (!user.osEscolhida) {
            // Tentar extrair número da OS da mensagem do usuário
            const numeroOSMencionado = await interpretarNumeroOS({ mensagem: mensagem, osList: user.osList });
            if (numeroOSMencionado && user.osList) {
              const osEncontrada = user.osList.find(os => os.id == numeroOSMencionado);
              if (osEncontrada) {
                console.log(`[DEBUG] mais_detalhes: OS ${numeroOSMencionado} detectada automaticamente na mensagem`);
                user.osEscolhida = osEncontrada;
              } else {
                console.log(`[DEBUG] mais_detalhes: OS ${numeroOSMencionado} mencionada não encontrada na lista do cliente`);
              }
            }
            
            // Se ainda não tem OS escolhida, usar a função gerarMensagemOSNaoSelecionada
            if (!user.osEscolhida) {
              resposta = gerarMensagemOSNaoSelecionada(user, 'Para ver mais detalhes, preciso saber qual OS você quer consultar.');
              break;
            }
          }
          if (user.osEscolhida) {
            // Se já tem OS escolhida, mostra os detalhes dela diretamente
            const os = user.osEscolhida;
            let dataFormatada = null;
            if (os.data_agenda_final && os.data_agenda_final !== '0000-00-00 00:00:00') {
              const dataObj = dayjs(os.data_agenda_final);
              const dia = dataObj.format('DD');
              const mes = dataObj.format('MMMM'); // Nome do mês por extenso
              const periodo = os.melhor_horario_agenda === 'M' ? 'manhã' : 'tarde';
              dataFormatada = `dia ${dia} do mês de ${mes} no período da ${periodo}`;
            }
            resposta = `Opa! Prontinho! Aqui estão os detalhes da sua OS ${os.id}:
          • Assunto: ${formatarDescricaoOS(os)}
          • Status: ${os.status === 'AG' ? 'Agendada' : os.status === 'A' ? 'Aberta' : os.status}
          ${dataFormatada ? `• Data agendada: ${dataFormatada}\n` : ''}${os.endereco ? `• Endereço: ${os.endereco}\n` : ''}Se precisar de mais alguma coisa, é só me chamar! 😊`;
            // Mantém o contexto da osEscolhida e atualiza o estado da conversa.
            user.etapaAnterior = user.etapaAtual; // Salva a etapa atual como anterior
            user.etapaAtual = 'mais_detalhes';
            user.tipoUltimaPergunta = 'DETALHES_OS_EXIBIDOS';
            usuarios[numero] = user; // Garante que o estado atualizado seja salvo
          } else {
             if (!resposta) { 
                resposta = 'Não consegui identificar a OS para mostrar os detalhes. Por favor, informe o número da OS.';
             }
          }
          break;
        }
        case 'confirmar_escolha_os': {
          console.log("\n[LOG] ➡️ Entrando no case 'confirmar_escolha_os'\n");
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }
          if (!user.osEscolhida) {
            console.log('Nenhuma OS escolhida');
            // console.log('user', user); // LOG-OS-INTEIRA
            console.log('mensagem do usuário:', mensagem);

            const mensagemLower = (mensagem || '').toLowerCase().trim();
            const confirmacoesPositivas = ['sim', 'ok', 'pode ser', 'fechado', 'confirmo', 'quero', 'vamos', 'perfeito', 'isso', 'isso mesmo', 'claro'];

            // Caso 1: Existe APENAS 1 OS ABERTA e o usuário respondeu afirmativamente
            if (Array.isArray(user.osList) && confirmacoesPositivas.some(p => mensagemLower.includes(p))) {
              const osAbertas = user.osList.filter(os => os.status === 'A' || os.status === 'EN');
              if (!user.osEscolhida && osAbertas.length === 1) {
                console.log('[DEBUG] confirmar_escolha_os: Selecionando automaticamente a única OS aberta após confirmação do usuário');
                user.osEscolhida = osAbertas[0];
              }
            }

            // Caso 2: Se não havia apenas 1 aberta, mas há somente 1 OS no total
            if (!user.osEscolhida && user.osList && user.osList.length === 1) {
              if (confirmacoesPositivas.some(palavra => mensagemLower.includes(palavra))) {
                console.log('[DEBUG] confirmar_escolha_os: Selecionando única OS disponível automaticamente');
                user.osEscolhida = user.osList[0];
              }
            }
            
            // Se ainda não conseguiu selecionar, tentar interpretar como número de OS
            if (!user.osEscolhida) {
              var idOsEscolhida = await interpretarNumeroOS({ mensagem: mensagem, osList: user.osList });
              if(idOsEscolhida){
                const osEscolhida = user.osList.find(os => os.id == idOsEscolhida);
                if(osEscolhida){
                  user.osEscolhida = osEscolhida;
                } 
              }
            }
            
            // Validar novamente após tentativa de extração
            const respostaObj = { get resposta() { return resposta; }, set resposta(value) { resposta = value; } };
            if (!validarOSEscolhida(user, respostaObj)) {
              break;
            }
          }
          
        
          // Sugerir datas disponíveis para a OS escolhida, se possível
          const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida);
          // console.log('[confirmar_escolha_os] user', user); // LOG-OS-INTEIRA
          // console.log('[confirmar_escolha_os] user.osEscolhida', user.osEscolhida); // LOG-OS-INTEIRA
          //console.log('[confirmar_escolha_os] sugestoes', sugestoes);
          //console.log('[confirmar_escolha_os] sugestoes.sugestao', sugestoes.sugestao);
          if (sugestoes && sugestoes.sugestao && sugestoes.sugestao.data && sugestoes.sugestao.periodo) {
            user.sugestaoData = sugestoes.sugestao.data;
            user.sugestaoPeriodo = sugestoes.sugestao.periodo;
            const dataFormatada = dayjs(sugestoes.sugestao.data).format('DD/MM/YYYY');
            const diaSemana = diaDaSemanaExtenso(sugestoes.sugestao.data);
            const periodoExtenso = sugestoes.sugestao.periodo === 'M' ? 'manhã' : 'tarde';
            const assunto = formatarDescricaoOS(user.osEscolhida);
            
            resposta = `Perfeito! Vamos agendar a visita para a OS ${user.osEscolhida.id} (${assunto}).\nSe preferir, tenho uma sugestão: ${diaSemana}, dia ${dataFormatada}, no período da ${periodoExtenso}.\nSe quiser outra data ou período, é só me informar! Qual data e período você prefere?`;
          console.log(`[LOG] 💬 Resposta construída no case 'confirmar_escolha_os': ${resposta}`);
          } else {
            resposta = tratarIndisponibilidadeAgendamento(user);
            user.osEscolhida = null;
          }
          // Atualiza etapa para esperar confirmação ou nova data
          user.etapaAnterior = user.etapaAtual;
          user.etapaAtual = 'aguardando_confirmacao_agendamento';
          user.tipoUltimaPergunta = 'AGENDAMENTO_SUGESTAO';
          break;
        }
        case 'verificar_os': {
          // Garantir que o usuário tem clienteId
          if (!(await ensureClienteId(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }))) {
            break;
          }

          // Verificar se o usuário está perguntando sobre OS agendadas especificamente
          const perguntaAgendadas = /agendad[ao]s?|já\s+agendad[ao]s?|visitas?\s+agendad[ao]s?/i.test(mensagem);
          
          if (perguntaAgendadas) {
            // console.log(`[DEBUG] verificar_os: Usuário perguntou sobre OS agendadas`);
            
            const lista = await buscarOSPorClienteId(user.clienteId);
            const osAgendadas = lista.filter(o => o.status === 'AG');
            
            // console.log(`[DEBUG] verificar_os - Total de OS: ${lista.length}`);
            // console.log(`[DEBUG] verificar_os - OS Agendadas encontradas: ${osAgendadas.length}`);
            // console.log(`[DEBUG] verificar_os - IDs das OS Agendadas: ${osAgendadas.map(o => o.id).join(', ')}`);
            
            if (osAgendadas.length > 0) {
              const listaAgendadas = formatarListaOS(osAgendadas, true); // true para incluir data
              resposta = `Sim, ${user.nomeCliente}! Você tem ${osAgendadas.length} visita(s) já agendada(s):\n\n${listaAgendadas}\n\nSe precisar reagendar ou ver mais detalhes de alguma, é só me avisar!`;
            } else {
              resposta = `Não, ${user.nomeCliente}. Você não tem nenhuma visita agendada no momento. Mas você tem ordens de serviço abertas que podem ser agendadas. Gostaria de ver a lista delas?`;
            }
            break;
          }

          // Tentar extrair número da OS da mensagem do usuário se não há OS selecionada
          if (!user.osEscolhida) {
            const numeroOSMencionado = await interpretarNumeroOS({ mensagem: mensagem, osList: user.osList });
            if (numeroOSMencionado && user.osList) {
              const osEncontrada = user.osList.find(os => os.id == numeroOSMencionado);
              if (osEncontrada) {
                console.log(`[DEBUG] verificar_os: OS ${numeroOSMencionado} detectada automaticamente na mensagem`);
                user.osEscolhida = osEncontrada;
              } else {
                console.log(`[DEBUG] verificar_os: OS ${numeroOSMencionado} mencionada não encontrada na lista do cliente`);
              }
            }
          }

          // Verificar se há uma OS selecionada
          if (!validarOSEscolhida(user, { get resposta() { return resposta; }, set resposta(value) { resposta = value; } }, 'Para ver os detalhes, preciso saber qual OS você quer consultar.')) {
            break;
          }

          // Mostrar detalhes da OS selecionada
          const os = user.osEscolhida;
          const descricao = formatarDescricaoOS(os);
          
          let detalhes = `📋 **Detalhes da OS ${os.id}**\n\n`;
          detalhes += `• **Assunto:** ${descricao}\n`;
          detalhes += `• **Status:** ${os.status === 'A' ? 'Aberta' : os.status === 'AG' ? 'Agendada' : os.status}\n`;
          
          if (os.data_agenda_final) {
            const dataFormatada = dayjs(os.data_agenda_final).format('DD/MM/YYYY [às] HH:mm');
            detalhes += `• **Agendamento:** ${dataFormatada}\n`;
          }
          
          if (os.melhor_horario_agenda) {
            const periodo = os.melhor_horario_agenda === 'M' ? 'Manhã' : os.melhor_horario_agenda === 'T' ? 'Tarde' : os.melhor_horario_agenda;
            detalhes += `• **Período preferido:** ${periodo}\n`;
          }
          
          if (os.id_tecnico) {
            detalhes += `• **Técnico:** ${os.id_tecnico}\n`;
          }
          
          if (os.data_cadastro) {
            const dataCadastro = dayjs(os.data_cadastro).format('DD/MM/YYYY');
            detalhes += `• **Data de abertura:** ${dataCadastro}\n`;
          }
          
          // Tratamento baseado no status da OS
          if (os.status === 'A') {
            // OS aberta - gerar sugestões de agendamento
            console.log(`[DEBUG] verificar_os: OS ${os.id} está aberta, gerando sugestões de agendamento`);
            try {
              const sugestoes = await gerarSugestoesDeAgendamento(os);
              
              if (sugestoes && sugestoes.sugestao && sugestoes.sugestao.data && sugestoes.sugestao.periodo) {
                const dataObj = dayjs(sugestoes.sugestao.data);
                const diaSemana = diaDaSemanaExtenso(dataObj);
                const periodoExtenso = sugestoes.sugestao.periodo === 'M' ? 'manhã' : 'tarde';
                
                detalhes += `\n🗓️ **Sugestão de Agendamento:**\n`;
                detalhes += `• ${diaSemana}, ${dataObj.format('DD/MM/YYYY')} no período da ${periodoExtenso}\n`;
                
                // Armazenar sugestão para facilitar confirmação posterior
                user.sugestaoData = sugestoes.sugestao.data;
                user.sugestaoPeriodo = sugestoes.sugestao.periodo;
                user.id_tecnico = sugestoes.sugestao.id_tecnico;
                user.tipoUltimaPergunta = 'AGENDAMENTO_SUGESTAO';
                
                if (sugestoes.alternativas && sugestoes.alternativas.length > 0) {
                  detalhes += `\n📅 **Outras opções disponíveis:**\n`;
                  sugestoes.alternativas.slice(0, 3).forEach(alt => {
                    const altDataObj = dayjs(alt.data);
                    const altDiaSemana = diaDaSemanaExtenso(altDataObj);
                    const altPeriodoExtenso = alt.periodo === 'M' ? 'manhã' : 'tarde';
                    detalhes += `• ${altDiaSemana}, ${altDataObj.format('DD/MM/YYYY')} - ${altPeriodoExtenso}\n`;
                  });
                }
                
                detalhes += `\nGostaria de confirmar o agendamento para ${diaSemana}, ${dataObj.format('DD/MM/YYYY')} no período da ${periodoExtenso}?`;
              } else {
                console.log(`[DEBUG] verificar_os: Nenhuma sugestão disponível para OS ${os.id}`);
                const mensagemIndisponibilidade = tratarIndisponibilidadeAgendamento(user);
                detalhes += `\n⚠️ **Agendamento:**\n${mensagemIndisponibilidade}`;
              }
            } catch (error) {
              console.error(`[ERROR] verificar_os: Erro ao gerar sugestões para OS ${os.id}:`, error);
              detalhes += `\n\nPara agendar esta OS, me informe sua data e período de preferência.`;
            }
          } else if (os.status === 'AG') {
            // OS já agendada - oferecer reagendamento
            console.log(`[DEBUG] verificar_os: OS ${os.id} já está agendada, oferecendo reagendamento`);
            
            if (os.data_agenda_final) {
              const dataAgendadaObj = dayjs(os.data_agenda_final);
              const diaSemanaAgendada = diaDaSemanaExtenso(dataAgendadaObj);
              const dataFormatada = dataAgendadaObj.format('DD/MM/YYYY [às] HH:mm');
              
              detalhes += `\n✅ **Status do Agendamento:**\n`;
              detalhes += `Esta OS já está agendada para ${diaSemanaAgendada}, ${dataFormatada}.\n`;
              
              // Gerar sugestões alternativas para reagendamento
              try {
                const sugestoes = await gerarSugestoesDeAgendamento(os);
                
                if (sugestoes && sugestoes.sugestao) {
                  detalhes += `\n🔄 **Opções para Reagendamento:**\n`;
                  
                  // Mostrar sugestão principal
                  const novaDataObj = dayjs(sugestoes.sugestao.data);
                  const novoDiaSemana = diaDaSemanaExtenso(novaDataObj);
                  const novoPeriodoExtenso = sugestoes.sugestao.periodo === 'M' ? 'manhã' : 'tarde';
                  detalhes += `• ${novoDiaSemana}, ${novaDataObj.format('DD/MM/YYYY')} no período da ${novoPeriodoExtenso}\n`;
                  
                  // Mostrar alternativas
                  if (sugestoes.alternativas && sugestoes.alternativas.length > 0) {
                    sugestoes.alternativas.slice(0, 2).forEach(alt => {
                      const altDataObj = dayjs(alt.data);
                      const altDiaSemana = diaDaSemanaExtenso(altDataObj);
                      const altPeriodoExtenso = alt.periodo === 'M' ? 'manhã' : 'tarde';
                      detalhes += `• ${altDiaSemana}, ${altDataObj.format('DD/MM/YYYY')} - ${altPeriodoExtenso}\n`;
                    });
                  }
                  
                  // Armazenar sugestão para facilitar reagendamento
                  user.sugestaoData = sugestoes.sugestao.data;
                  user.sugestaoPeriodo = sugestoes.sugestao.periodo;
                  user.id_tecnico = sugestoes.sugestao.id_tecnico;
                  user.tipoUltimaPergunta = 'REAGENDAMENTO_SUGESTAO';
                  
                  detalhes += `\nGostaria de reagendar para ${novoDiaSemana}, ${novaDataObj.format('DD/MM/YYYY')} no período da ${novoPeriodoExtenso}?`;
                } else {
                  detalhes += `\n\nSe precisar reagendar, me informe sua nova data e período de preferência.`;
                }
              } catch (error) {
                console.error(`[ERROR] verificar_os: Erro ao gerar sugestões de reagendamento para OS ${os.id}:`, error);
                detalhes += `\n\nSe precisar reagendar, me informe sua nova data e período de preferência.`;
              }
            } else {
              detalhes += `\n⚠️ Esta OS está marcada como agendada, mas não encontrei a data do agendamento.\n`;
              detalhes += `Gostaria de definir uma nova data de agendamento?`;
            }
          } else {
            detalhes += `\nPosso ajudar com mais alguma coisa sobre esta OS?`;
          }
          
          resposta = detalhes;
          break;
        }
        case 'finalizado':
        default:
        {
          resposta = await gerarMensagemDaIntent({
            intent: 'finalizado',
            agentId: 'agent_os',
            dados: contexto,
            promptExtra: 'Encerrar atendimento.',
          });
          // Preservar dados essenciais e limpar apenas o que pode atrapalhar um novo fluxo
          const identidade = {
            numero: user.numero,
            cpf: user.cpf,
            clienteId: user.clienteId,
            nomeCliente: user.nomeCliente,
          };
          usuarios[numero] = {
            ...identidade,
            etapa: 'inicio',
            etapaAnterior: '',
            etapaAtual: 'inicio',
            mensagemAnteriorGPT: '',
            mensagemAnteriorCliente: '',
            // Limpar variáveis de agendamento/estado para evitar interferência
            osList: [],
            osEscolhida: null,
            ultimaListaOS: [],
            dataInterpretada: null,
            periodoAgendamento: null,
            sugestaoData: null,
            sugestaoPeriodo: null,
            sugestoesAgendamento: null,
            id_tecnico: null,
            aguardandoConfirmacao: false,
            tipoUltimaPergunta: null,
          };
          // Recarregar lista de OS do cliente após finalização
          if (identidade.clienteId) {
            try {
              buscarOSPorClienteId(identidade.clienteId)
                .then(osListAtualizada => {
                  if (Array.isArray(osListAtualizada)) {
                    usuarios[numero].osList = osListAtualizada;
                    console.log(`[finalizado] Lista de OS recarregada: ${osListAtualizada.length} OS`);
                  } else {
                    usuarios[numero].osList = [];
                  }
                })
                .catch(err => console.error('[finalizado] Erro ao recarregar OS:', err));
            } catch (e) {
              console.error('[finalizado] Falha ao iniciar recarga de OS:', e);
            }
          }
          break;
        }
      } 
   
    if (!resposta) {
      // If, after all processing, 'resposta' is still empty, then provide a generic fallback.
      // This ensures that the bot always says something.
      if (user.clienteId && (!user.osList || user.osList.length === 0)) {
        // If user is identified but has no OS, this could be a common scenario for a generic reply.
        resposta = "Não encontrei Ordens de Serviço para você no momento. Gostaria de tentar outra opção?";
      } else if (user.clienteId && user.osList && user.osList.length > 0 && !user.osEscolhida) {
        // If user is identified, has OS list, but none is chosen, prompt to choose.
        resposta = "Tenho algumas Ordens de Serviço aqui. Para qual delas você gostaria de atendimento? Por favor, me informe o número da OS.";
      } else if (user.clienteId) {
        // Generic message if user is identified but context is unclear.
        resposta = "Como posso te ajudar hoje?";
      } else {
        // Default fallback if no context at all.
        resposta = 'Desculpe, não consegui entender. Pode tentar novamente? Se precisar de ajuda, digite "opções".';
      }
    }

    // Refatora a resposta original com um guardião de timeout e fallback para a resposta bruta
    try {
      const refinoPromise = refatorarResposta(resposta, 'agent_supervisor', user, intent, mensagem, contexto, user.dataInterpretada);
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 5000)); // 5s timeout
      const refinada = await Promise.race([refinoPromise, timeoutPromise]);
      if (typeof refinada === 'string' && refinada.trim().length > 0) {
        resposta = refinada.trim();
      } // senão, mantém a resposta original
      user.mensagemAnteriorGPT = resposta;
    } catch (e) {
      console.error('[refatorarResposta] falhou, enviando resposta original:', e?.message || e);
      // mantém 'resposta' como estava
    }


    /* ----------- LOG COMPLETO DO ESTADO ANTES DE RESPONDER --------- */
    logEstado({ numero, user, intent, resposta });

    /* -------------------- 6. Persistência sessão ------------------- */
    user.etapaAnterior = user.etapaAtual || 'inicio'; // <- guarda o que era
    user.etapaAtual = intent;                      // <- atualiza para a nova intent
    user.mensagemAnteriorGPT = resposta;
    user.mensagemAnteriorCliente = mensagem;
    user.numero = numero; // Garante que o número sempre está presente
    usuarios[numero] = user;

    /* -------------------- 7. Envia WhatsApp ------------------------ */
    const twilioWhatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
    if (!twilioWhatsappNumber) {
      console.error('❌ ERRO FATAL: Variável de ambiente TWILIO_WHATSAPP_NUMBER não definida!');
      // Não podemos enviar resposta sem o número de origem
      return res.status(500).send('Erro de configuração do servidor: TWILIO_WHATSAPP_NUMBER não definido.');
    }

    if (!numero) {
      console.error('❌ ERRO: número do destinatário está undefined. Não é possível enviar mensagem.');
      return res.status(500).send('Erro interno: número do destinatário não encontrado na sessão.');
    }
    let messageData = {
      to: numero,
      from: twilioWhatsappNumber
    };

    if (responderComAudio) {
      try {
        console.log('[Webhook Unificado] Gerando áudio da resposta para:', resposta);
        const urlAudioResposta = await gerarAudioUrl(resposta);
        messageData.mediaUrl = [urlAudioResposta];
        console.log(`[Webhook Unificado] Áudio da resposta gerado: ${urlAudioResposta}`);
      } catch (err) {
        console.error('[Webhook Unificado] Erro ao gerar áudio da resposta, enviando como texto:', err.message);
        messageData.body = resposta; // Fallback para texto
      }
    } else {
      messageData.body = resposta;
    }

    // Outbound guard: evita envio duplicado do mesmo conteúdo em janela curta
    let outboundBody = '';
    if (messageData.mediaUrl && messageData.mediaUrl.length > 0) {
      outboundBody = `media:${hashString(messageData.mediaUrl[0])}`;
    } else {
      const normOut = normalizeBodyForDedup(messageData.body || '');
      outboundBody = normOut.normalized;
    }
    const outboundKey = `out:${numero}:${outboundBody}`;
    if (isDuplicateKey(outboundKey, OUTBOUND_TTL_MS)) {
      console.log('[DEDUP][OUTBOUND] hit', JSON.stringify({ key: outboundKey, numero, ttlMs: OUTBOUND_TTL_MS }));
    } else {
      // Marca que este inbound teve resposta, para não responder diferente em outra rota
      markResponded(respondKey);
      await enviarMensagemWhatsApp(messageData);
    }
    // Libera o lock de processamento
    global.__processingLocks.delete(respondKey);
    console.log(`✅ Mensagem enviada para ${numero}. Conteúdo: ${messageData.body || messageData.mediaUrl}`);

    // Prepara o payload de resposta detalhado para o HTTP response
    const responsePayload = {
      status: 'ok',
      recipient: numero,
      incomingMessage: mensagem, // Mensagem original ou transcrita do usuário
      detectedIntent: user.etapaAnterior, // Intent que acabou de ser processada
      previousClientMessage: user.mensagemAnteriorCliente || null, // Mensagem anterior do cliente
      previousBotMessage: user.mensagemAnteriorGPT || null, // Mensagem anterior do assistente
      response: {
        type: (responderComAudio && messageData.mediaUrl && messageData.mediaUrl.length > 0) ? 'audio' : 'text',
        content: (responderComAudio && messageData.mediaUrl && messageData.mediaUrl.length > 0) ? messageData.mediaUrl[0] : messageData.body,
        textEquivalent: resposta // Texto base da resposta, mesmo se áudio foi enviado
      },
      session: {
        currentStep: user.etapaAtual, // Próxima etapa da conversa
        cpf: user.cpf,
        clienteId: user.clienteId,
        osId: user.osEscolhida ? user.osEscolhida.id : null,
        dataAgendamento: user.dataInterpretada,
        periodoAgendamento: user.periodoAgendamento
      }
    };
    res.status(200).json(responsePayload); // Envia JSON detalhado

  } catch (error) {
    console.error('Erro no webhook:', error);
    // Tenta enviar uma mensagem de erro genérica se possível
    try {
      const twilioWhatsappNumberFallback = process.env.TWILIO_WHATSAPP_NUMBER;
      if (twilioWhatsappNumberFallback) {
        if (!numero) {
           console.error('❌ ERRO: número do destinatário está undefined. Não é possível enviar mensagem de erro.');
           return;
         }
         await enviarMensagemWhatsApp({
           to: numero,
          from: twilioWhatsappNumberFallback,
          body: 'Desculpe, ocorreu um erro interno ao processar sua solicitação. Envie novamente seu CPF para que a gente recomece a conversa.'
        });
      }
    } catch (sendError) {
      console.error('Erro ao enviar mensagem de erro para o usuário:', sendError);
    }
    res.status(500).send('Erro interno do servidor');
  }
});

/**
 * Formata a descrição de uma OS com fallback para diferentes campos
 * @param {Object} os - Objeto da OS
 * @returns {string} Descrição formatada
 */
function formatarDescricaoOS(os) {
  return os.descricaoAssunto || os.titulo || os.mensagem || 'Sem descrição';
}

/**
 * Formata uma lista de OSs para exibição
 * @param {Array} osList - Lista de OSs
 * @param {boolean} incluirData - Se deve incluir data de agendamento (para OSs agendadas)
 * @returns {string} Lista formatada
 */
function formatarListaOS(osList, incluirData = false) {
  return osList.map(os => {
    let linha = `• ${os.id} - ${formatarDescricaoOS(os)}`;
    
    if (incluirData && os.data_agenda_final) {
      const dataFormatada = dayjs(os.data_agenda_final).format('DD/MM/YYYY [às] HH:mm');
      linha += ` (agendada para ${dataFormatada})`;
    }
    
    return linha;
  }).join('\n');
}

module.exports = router;
