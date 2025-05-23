const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
// Configurar dayjs para usar português
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
  verificarDisponibilidade
} = require('../services/ixcService');
const {
  detectarIntentComContexto,
  gerarMensagemDaIntent,
  interpretarDataNatural,
  interpretarNumeroOS,
  interpretarEscolhaOS
} = require('../services/openaiService');

/* ---------------------------------------------------------
   Função adaptadora para substituir interpretaDataePeriodo
--------------------------------------------------------- */
async function interpretaDataePeriodo({ mensagem, agentId = 'default-agent', dados = {}, promptExtra = '' }) {
  try {
    // Primeiro, tenta extrair a data da mensagem
    const dataInterp = await interpretarDataNatural(mensagem, agentId, dados, promptExtra + 'Frase do usuário: "' + mensagem + '"');
    console.log('====== DATA INTERPRETADA: ======');
    console.log(dataInterp);
    console.log('===============================')

    // Se não encontrou data válida, retorna null
    if (!dataInterp || !dayjs(dataInterp).isValid()) {
      return null;
    }

   // Retorna objeto com data e período
    return {
      data_interpretada: dataInterp.data_interpretada,
      periodo_interpretado: dataInterp.periodo_interpretado || 'T' // Default para tarde se não encontrou período
    };
  } catch (error) {
    console.error('Erro ao interpretar data e período:', error);
    return null;
  }
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
      '8h', '9h', '10h', '11h', '8:00', '9:00', '10:00', '11:00',
      '8 horas', '9 horas', '10 horas', '11 horas',
      'oito horas', 'nove horas', 'dez horas', 'onze horas'
    ];
    
    // Palavras-chave para identificar período da tarde
    const keywordsTarde = [
      'tarde', 'vespertino', 'depois do almoco', 'depois do almoço', 
      'depois do meio dia', 'pm', 'p.m', 'p.m.', 'de tarde', 'pela tarde',
      '13h', '14h', '15h', '16h', '17h', '18h', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
      '1h', '2h', '3h', '4h', '5h', '6h', '1:00', '2:00', '3:00', '4:00', '5:00', '6:00',
      '13 horas', '14 horas', '15 horas', '16 horas', '17 horas', '18 horas',
      '1 hora', '2 horas', '3 horas', '4 horas', '5 horas', '6 horas',
      'uma hora', 'duas horas', 'tres horas', 'quatro horas', 'cinco horas', 'seis horas'
    ];
    
    // Verificar se a mensagem contém palavras-chave de manhã
    for (const keyword of keywordsManha) {
      if (msgLower.includes(keyword)) {
        console.log(`Período da manhã identificado pela palavra-chave: ${keyword}`);
        return 'M';
      }
    }
    
    // Verificar se a mensagem contém palavras-chave de tarde
    for (const keyword of keywordsTarde) {
      if (msgLower.includes(keyword)) {
        console.log(`Período da tarde identificado pela palavra-chave: ${keyword}`);
        return 'T';
      }
    }
    
    // Se não encontrou nenhum período específico, retorna null
    return null;
  } catch (error) {
    console.error('Erro ao interpretar período:', error);
    return null;
  }
}

/* ---------------------------------------------------------
   Helpers reutilizáveis
--------------------------------------------------------- */
/**
 * Retorna true se precisar pedir o CPF, e define user._respostaCPF com a resposta adequada.
 * Uso: if (await verificaClienteIdOuPedeCPF(user, contexto, intent)) { resposta = user._respostaCPF; break; }
 */
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

/* ---------------------------------------------------------
   Sessões em memória (por número)
--------------------------------------------------------- */
const usuarios = {}; // { [numeroWhatsapp]: userState }

/* ---------------------------------------------------------
   Helpers utilitários
--------------------------------------------------------- */
const extrairCpf = (texto = '') => {
  const m = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  return m ? m[0].replace(/[^\d]/g, '') : null;
};
const gerarPromptContextualizado = dados => {
  const l = [];

  if (dados.nome) l.push(`O usuário se chama ${dados.nome}.`);
  if (dados.cpf) l.push(`O CPF informado é ${dados.cpf}.`);

  /* ---------- 1) Lista resumida das OS abertas ---------- */
  if (Array.isArray(dados.osList) && dados.osList.length) {
    const resumo = dados.osList
      .map(o => `• ${o.id} - ${o.titulo || o.mensagem || 'Sem descrição'}`)
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

  etapaAtual: user.etapaAtual,
  observacao
});
/* ---------------------------------------------------------
   Funções auxiliares para processamento de OS
--------------------------------------------------------- */

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
      console.log(`Número de OS extraído da mensagem: ${osIdExtraido}`);
      
      // Verificar se a OS existe na lista
      const osEncontrada = osList.find(os => os.id === osIdExtraido);
      if (osEncontrada) {
        return { osObj: osEncontrada };
      }
    }
    
    // Se não encontrou pelo número, tenta interpretar a posição
    const posicao = await interpretarEscolhaOS({
      mensagem,
      osList,
      agentId: 'default-agent',
      dados: contexto,
      promptExtra: 'tente identificar a escolha da OS.'
    });
    
    if (posicao && osList[posicao - 1]) {
      return { osObj: osList[posicao - 1] };
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
 * Verifica se existe uma OS selecionada e tenta encontrar uma no contexto se não existir
 * @param {Object} user - Objeto do usuário
 * @param {string} mensagemPersonalizada - Mensagem personalizada opcional
 * @param {string} mensagem - Mensagem do usuário para tentar extrair o número da OS
 * @param {Object} contexto - Contexto da conversa
 * @param {string} intent - Intent atual
 * @returns {Object} - { osExiste: boolean, resposta: string, osObj: Object }
 */
async function verificarOSEscolhida(user, mensagemPersonalizada = null, mensagem = null, contexto = null, intent = null) {
  // Se já existe uma OS escolhida, retorna sucesso
  if (user.osEscolhida) {
    return { osExiste: true, osObj: user.osEscolhida };
  }
  
  // Se temos mensagem, contexto e a lista de OS, tenta interpretar a OS da mensagem
  if (mensagem && contexto && intent && user.osList && user.osList.length > 0) {
    try {
      console.log('Tentando identificar OS na mensagem:', mensagem);
      const resultado = await processarEscolhaOS({
        mensagem,
        contexto,
        intent,
        osList: user.osList
      });
      
      // Se encontrou uma OS, define no user e retorna sucesso
      if (resultado.osObj) {
        user.osEscolhida = resultado.osObj;
        console.log('OS identificada automaticamente:', resultado.osObj.id);
        return { osExiste: true, osObj: resultado.osObj };
      }
      
      // Se não encontrou mas temos uma resposta personalizada do processamento
      if (resultado.resposta) {
        return { osExiste: false, resposta: resultado.resposta };
      }
    } catch (error) {
      console.error('Erro ao tentar identificar OS na mensagem:', error);
    }
  }
  
  // Se não conseguiu identificar a OS ou não tinha informações suficientes
  const mensagemPadrao = 'Para continuar, preciso saber qual ordem de serviço você deseja. Pode me informar o número da OS?';
  return { 
    osExiste: false, 
    resposta: mensagemPersonalizada || mensagemPadrao 
  };
}

/* ---------------------------------------------------------
   Rota principal – Webhook Twilio
--------------------------------------------------------- */
router.post('/', express.urlencoded({ extended: false }), async (req, res) => { // Adicionado urlencoded para Twilio audio
  // Log da requisição completa para depuração (semelhante ao webhook_voz)
  console.log('--- [Webhook Unificado] INCOMING REQUEST ---');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  // IGNORAR WEBHOOKS DE STATUS/ERRO DA TWILIO
  if (req.body.Level === 'ERROR' || req.body.MessageStatus || req.body.SmsStatus) {
    console.log('[Webhook Unificado] Ignorando webhook de status/erro da Twilio.');
    return res.status(200).send('Webhook de status/erro recebido e ignorado.');
  }

  // Corrigido: garantir que Body é string antes de chamar .trim()
  console.log('Tipo de req.body.Body:', typeof req.body.Body, 'Valor:', req.body.Body);
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
    dataInterpretada: null, periodoAgendamento: null
  };
// Sempre sincroniza o número na sessão
user.numero = numero;

  /* -------------------- 2. Gera contexto p/ LLM ------------------- */
  const dados = geraDados(user, mensagem);
  const contexto = gerarPromptContextualizado(dados);
  let resposta = '';

  try {
    /* -------------------- 3. Detecta INTENT ----------------------- */
    console.log('🟦 [DEBUG] Chamando detectarIntentComContexto com:', {
      mensagem,
      agentId: 'default-agent',
      promptExtra: contexto,
      intentAnterior: user.etapaAnterior,
      mensagemAnteriorGPT: user.mensagemAnteriorGPT
    });
    let intentResult = null;
    try {
      intentResult = await detectarIntentComContexto({
        mensagem, // Usa a mensagem (texto original ou transcrito)
        agentId: 'default-agent',
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

    console.log("================== Nova Intent Detectada ==================")
    console.log("==================" + intent + "=============================")
    console.log("================== Nova Intent Detectada ==================")

    /* -------------------- 4. Fluxo principal ---------------------- */
      switch (intent) {

        /* --------------------------------------------------------------------
          4.X RECUSAR/CANCELAR
        -------------------------------------------------------------------- */

        case 'extrair_cpf':{
          resposta = user._respostaCPF;
          const cpf = extrairCpf(mensagem);
          if (!cpf) { resposta = 'CPF inválido, pode enviar novamente?'; }
    
          user.cpf = cpf;
          let osAbertas = [];
          let osAgendadas = [];
          let cliente = null;
          try {
            console.log('[DEBUG] Chamando buscarClientePorCpf com CPF:', cpf);
            cliente = await buscarClientePorCpf(cpf);
            console.log('[DEBUG] Resposta buscarClientePorCpf:', JSON.stringify(cliente));
          } catch (errCliente) {
            if (errCliente.response) {
              // Axios error
              console.error('[ERRO] buscarClientePorCpf - status:', errCliente.response.status);
              console.error('[ERRO] buscarClientePorCpf - data:', errCliente.response.data);
              console.error('[ERRO] buscarClientePorCpf - headers:', errCliente.response.headers);
            } else {
              console.error('[ERRO] buscarClientePorCpf:', errCliente);
            }
            // Opcional: repassar erro para o usuário
            resposta = 'Erro ao buscar cliente: ' + (errCliente.response ? errCliente.response.status + ' - ' + JSON.stringify(errCliente.response.data) : errCliente.message);
            user.clienteId = null;
            user.nomeCliente = null;
            // Sair do fluxo
            return enviarResposta(numero, resposta, user);
          }
          
          console.log("================== mensagem ==================")  
          console.log("==================" + mensagem + "=============================")
          console.log("================== mensagem ==================")  
          console.log("================== cpf ==================")  
          console.log("==================" + cpf + "=============================")
          console.log("================== cpf ==================")  
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
            osAbertas = lista.filter(o => o.status === 'A');
            osAgendadas = lista.filter(o => o.status === 'AG');
            user.osList = lista.filter(o => ['A', 'AG', 'EN'].includes(o.status));
    
            let partes = [`✅ Cadastro localizado, ${user.nomeCliente}.`];
            if (osAbertas.length) {
              const listaAbertas = osAbertas.map(o => `• ${o.id} - ${o.titulo || o.mensagem || 'Sem descrição'}`).join('\n');
              partes.push(`Encontrei ${osAbertas.length} OS aberta(s):\n${listaAbertas}\nSe quiser, posso te ajudar a agendar uma visita. Informe o número da OS para agendar.`);
            }
            if (osAgendadas.length) {
              const listaAgendadas = osAgendadas.map(o => `• ${o.id} - ${o.titulo || o.mensagem || 'Sem descrição'}`).join('\n');
              partes.push(`Você já possui ${osAgendadas.length} OS agendada(s):\n${listaAgendadas}\nDeseja ver detalhes do dia da visita? Responda com o número da OS para mais informações.`);
            }
            if (!osAbertas.length && !osAgendadas.length) {
              partes.push('Não há OS abertas ou agendadas no momento.');
            }
            resposta = partes.join('\n\n');
          }
          break;
        }

        /* --------------------------------------------------------------------
          4.5 RECUSAR/CANCELAR
        -------------------------------------------------------------------- */
        case 'recusar_cancelar': {if (!user.clienteId) { break;}
          // Limpa variáveis relacionadas ao fluxo
          user.osEscolhida = null;
          user.dataInterpretada = null;
          user.periodoAgendamento = null;
          user.etapaAtual = 'inicio';
          user.etapaAnterior = '';
          resposta = 'Tudo bem, cancelei o processo para você. Se precisar retomar ou tiver outra dúvida, é só me chamar! 😊';
          break;
        }
        /* --------------------------------------------------------------------
          4.X MUDAR DE OS
        -------------------------------------------------------------------- */
        case 'mudar_de_os': {if (!user.clienteId) { break;}
          // Limpar variáveis relacionadas ao agendamento
          user.dataInterpretada = null;
          user.periodoAgendamento = null;
          
          // Tentar extrair o número da OS da mensagem do usuário
          const osPattern = /\b(\d{4,6})\b/; // Padrão para encontrar números de 4-6 dígitos (formato típico de OS)
          const osMatch = mensagem.match(osPattern);
          let osIdExtraido = null;
          
          if (osMatch) {
            osIdExtraido = osMatch[1];
            console.log(`Número de OS extraído da mensagem: ${osIdExtraido}`);
            
            // Verificar se a OS existe na lista do usuário
            if (user.osList && user.osList.length > 0) {
              const osEncontrada = user.osList.find(os => os.id === osIdExtraido);
              if (osEncontrada) {
                user.osEscolhida = osEncontrada;
                user.etapaAtual = 'agendar_data';
                user.etapaAnterior = 'escolher_os';
                
                // Gerar sugestões de agendamento para a OS escolhida
                const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida);
                user.sugestaoData = sugestoes.sugestao.data;
                user.sugestaoPeriodo = sugestoes.sugestao.periodo;
                
                // Formatar a data e o período para a mensagem
                const dataFormatada = dayjs(sugestoes.sugestao.data).format('DD/MM/YYYY');
                const diaSemana = diaDaSemanaExtenso(sugestoes.sugestao.data);
                // Capitalizar primeira letra do dia da semana
                const diaSemanaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
                const periodoExtenso = sugestoes.sugestao.periodo === 'M' ? 'manhã' : 'tarde';
                const assunto = user.osEscolhida.titulo || user.osEscolhida.mensagem || `OS ${user.osEscolhida.id}`;
                
                resposta = `Ótimo! Vamos reagendar a ${assunto}. ` +
                          `Que tal ${diaSemanaCapitalizado}, dia ${dataFormatada}, no período da ${periodoExtenso}? ` +
                          `Está bom para você ou prefere outra data?`;
                break;
              }
            }
          }
          
          // Se não conseguiu extrair a OS ou a OS não foi encontrada
          user.osEscolhida = null;
          user.etapaAtual = 'escolher_os';
          user.etapaAnterior = '';
          
          // Mostrar as OS disponíveis para o usuário
          let mensagemOS = 'Sem problemas! Vamos reagendar uma ordem de serviço. ';
          
          if (user.osList && user.osList.length > 0) {
            const abertas = user.osList.filter(os => os.status === 'A');
            const agendadas = user.osList.filter(os => os.status === 'AG');
            
            if (abertas.length > 0) {
              mensagemOS += '\n\nOS abertas para agendar:';
              abertas.forEach(os => {
                mensagemOS += `\n• ${os.id} - ${os.titulo || os.mensagem || 'Sem descrição'}`;
              });
            }
            
            if (agendadas.length > 0) {
              mensagemOS += '\n\nOS já agendadas que podem ser reagendadas:';
              agendadas.forEach(os => {
                const dataAgendada = os.data_agenda_final ? dayjs(os.data_agenda_final).format('DD/MM/YYYY') : 'data não informada';
                const periodo = os.melhor_horario_agenda === 'M' ? 'manhã' : 'tarde';
                mensagemOS += `\n• ${os.id} - ${os.titulo || os.mensagem || 'Sem descrição'} (agendada para ${dataAgendada} - ${periodo})`;
              });
            }
            
            mensagemOS += '\n\nPor favor, me informe o número da OS que deseja reagendar.';
          } else {
            mensagemOS += 'No momento, não encontrei nenhuma OS disponível para reagendamento. Por favor, entre em contato com nosso suporte.';
          }
          
          resposta = mensagemOS;
          break;
        }
        /* --------------------------------------------------------------------
          4.X LISTAR OPCOES
        -------------------------------------------------------------------- */
        case 'listar_opcoes': {if (!user.clienteId) { break;}
          // Monta lista de OS disponíveis
          let osMsg = 'Nenhuma OS disponível.';
          if (user.osList && user.osList.length) {
            osMsg = user.osList.map(o => `• ${o.id} - ${o.titulo || o.mensagem || 'Sem descrição'}`).join('\n');
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
        // /* --------------------------------------------------------------------
        //   4.1 INICIO
        // -------------------------------------------------------------------- */
        case 'inicio': {if (!user.clienteId) { break;}
            user._respostaCPF = await gerarMensagemDaIntent({
              intent,
              agentId: 'default-agent',
              dados: contexto,
              promptExtra: user.cpf ? 'Não solicite o CPF.' : 'Peça o CPF para iniciar.'
            });
        }

        /* --------------------------------------------------------------------
          4.2 ALEATORIO
        -------------------------------------------------------------------- */
        case 'aleatorio': {if (!user.clienteId) { break;}
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
                user.etapaAtual = 'agendar_data';
                user.etapaAnterior = 'escolher_os';
                
                // Gerar sugestões de agendamento para a OS escolhida
                const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida);
                user.sugestaoData = sugestoes.sugestao.data;
                user.sugestaoPeriodo = sugestoes.sugestao.periodo;
                
                // Formatar a data e o período para a mensagem
                const dataFormatada = dayjs(sugestoes.sugestao.data).format('DD/MM/YYYY');
                const diaSemana = diaDaSemanaExtenso(sugestoes.sugestao.data);
                // Capitalizar primeira letra do dia da semana
                const diaSemanaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
                const periodoExtenso = sugestoes.sugestao.periodo === 'M' ? 'manhã' : 'tarde';
                const assunto = user.osEscolhida.titulo || user.osEscolhida.mensagem || `OS ${user.osEscolhida.id}`;
                
                resposta = `Ótimo! Vamos agendar a ${assunto}. ` +
                          `Que tal ${diaSemanaCapitalizado}, dia ${dataFormatada}, no período da ${periodoExtenso}? ` +
                          `Está bom para você ou prefere outra data?`;
                break;
              }
            }
          }
          
          // Se não for relacionado a uma sugestão de OS, continuar com o fluxo normal
          if (!user.cpf) {
            resposta = await gerarMensagemDaIntent({ intent, agentId: 'default-agent', dados: contexto, promptExtra: 'Peça o CPF.' });
          } else if (['verificar_os', 'escolher_os', 'agendar_data', 'extrair_data', 'extrair_hora', 'confirmar_agendamento'].includes(user.etapaAnterior)) {
            resposta = await gerarMensagemDaIntent({ intent, agentId: 'default-agent', dados: contexto, promptExtra: 'Solicite que o cliente conclua a etapa anterior.' });
          } else {
            resposta = await gerarMensagemDaIntent({ intent, agentId: 'default-agent', dados: contexto });
          }
          break;
        }

        /* --------------------------------------------------------------------
          4.4 VERIFICAR OS
        -------------------------------------------------------------------- */
        case 'verificar_os': {if (!user.clienteId) { break;}
          // Buscar OS
          const lista = await buscarOSPorClienteId(user.clienteId);
          const osAbertas = lista.filter(o => o.status === 'A' || o.status === 'EN');
          const osAgendadas = lista.filter(o => o.status === 'AG');
          user.osList = lista.filter(o => ['A', 'AG', 'EN'].includes(o.status));

          let partes = [];
          if (osAbertas.length) {
            const listaAbertas = osAbertas.map(o => `• ${o.id} - ${o.titulo || o.mensagem || 'Sem descrição'}`).join('\n');
            const plural = osAbertas.length > 1;
            partes.push(
              `OS aberta${plural ? 's' : ''} encontrada${plural ? 's' : ''} (${osAbertas.length}):\n${listaAbertas}\n\n` +
              `Gostaria de agendar ${plural ? 'alguma delas' : 'ela'}?`
            );
          }
          if (osAgendadas.length) {
            const listaAgendadas = osAgendadas.map(o => `• ${o.id} - ${o.titulo || o.mensagem || 'Sem descrição'}`).join('\n');
            const plural = osAgendadas.length > 1;
            partes.push(
              `OS agendada${plural ? 's' : ''} encontrada${plural ? 's' : ''} (${osAgendadas.length}):\n${listaAgendadas}\n\n` +
              `Gostaria de ver mais detalhes ou reagendar ${plural ? 'alguma delas' : 'ela'}?`
            );
          }
          if (!osAbertas.length && !osAgendadas.length) {
            partes.push('Não há OS abertas ou agendadas no momento.');
          }

          resposta = partes.join('\n\n');
          break;
        }

        /* --------------------------------------------------------------------
          4.5 ESCOLHER OS
        -------------------------------------------------------------------- */
        case 'escolher_os': {if (!user.clienteId) { break;}
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

          // Verificar o status da OS selecionada
          if (user.osEscolhida.status === 'AG') {
            // OS já está agendada - perguntar se quer mais informações ou reagendar
            const dataAgendada = user.osEscolhida.data_agenda_final ? 
              dayjs(user.osEscolhida.data_agenda_final).format('DD/MM/YYYY') : 'data não definida';
            const periodoAgendado = user.osEscolhida.melhor_horario_agenda === 'M' ? 'manhã' : 'tarde';
            const diaSemanaAgendado = user.osEscolhida.data_agenda_final ? 
                                    diaDaSemanaExtenso(user.osEscolhida.data_agenda_final) : '';
            const assunto = user.osEscolhida.titulo || user.osEscolhida.mensagem || `OS ${user.osEscolhida.id}`;
            
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
            resposta = `Nenhum horário disponível para agendamento com os técnicos deste setor.`;
            break;
          }

          // Guarda todas as alternativas de datas disponíveis
          user.datasDisponiveis = sugestoes.alternativas;
          // Inicializa variável para armazenar a escolha do usuário
          user.datasDisponivelEscolhida = null;

          user.sugestaoData = sugestoes.sugestao.data;
          user.sugestaoPeriodo = sugestoes.sugestao.periodo; // Armazena o período (M/T) em vez do horário
          user.tipoUltimaPergunta = 'AGENDAMENTO';

          // Formatar a data e o período para a mensagem
          const dataFormatada = dayjs(sugestoes.sugestao.data).format('DD/MM/YYYY');
          const diaSemana = diaDaSemanaExtenso(sugestoes.sugestao.data);
          const periodoExtenso = sugestoes.sugestao.periodo === 'M' ? 'manhã' : 'tarde';
          const assunto = osObj.titulo || osObj.mensagem || `OS ${osObj.id}`;

          // Agrupa alternativas por data e limita a 3 períodos distintos por dia
          const alternativasPorDia = {};
          for (const alt of sugestoes.alternativas) {
            if (!alternativasPorDia[alt.data]) alternativasPorDia[alt.data] = [];
            // Só adiciona se ainda não atingiu 2 períodos distintos para o dia (manhã e tarde)
            if (alternativasPorDia[alt.data].length < 2 && !alternativasPorDia[alt.data].some(p => p === alt.periodo)) {
              alternativasPorDia[alt.data].push(alt.periodo);
            }
          }
          // Monta lista final de alternativas (data + período, sem técnico)
          const alternativasFormatadas = [];
          Object.entries(alternativasPorDia).forEach(([data, periodos]) => {
            periodos.forEach(periodo => {
              const periodoTexto = periodo === 'M' ? 'manhã' : 'tarde';
              const diaSemanaAlt = diaDaSemanaExtenso(data);
              alternativasFormatadas.push(`${diaSemanaAlt}, ${dayjs(data).format('DD/MM/YYYY')} pela ${periodoTexto}`);
            });
          });
          // Limita o total de alternativas exibidas (opcional, pode limitar a 5 por exemplo)
          const alternativasExibir = alternativasFormatadas.slice(0, 5);

          // Mensagem amigável e detalhada conforme solicitado
          resposta = `Ótimo! Tenho uma sugestão para sua visita de ${assunto}! ` +
            `Que tal ${diaSemana}, dia ${dataFormatada}, no período da ${periodoExtenso}?\n\n` +
            `Está bom para você ou prefere outra opção? Se preferir, posso verificar outras datas disponíveis.`;
          break;
        }

        case 'datas_disponiveis': {if (!user.clienteId) { break;}
          // Verificar se existe uma OS selecionada ou tentar identificar da mensagem
          const verificacao = await verificarOSEscolhida(
            user, 
            'Para ver datas disponíveis, preciso saber qual ordem de serviço você deseja agendar. Pode me informar?',
            mensagem,
            contexto,
            intent
          );
          if (!verificacao.osExiste) {
            resposta = verificacao.resposta;
            break;
          }

          // Se a OS já está agendada, informa e oferece opções
          if (user.osEscolhida.status === 'AG') {
            const dataAgendada = user.osEscolhida.data_agenda_final ? 
              dayjs(user.osEscolhida.data_agenda_final).format('DD/MM/YYYY') : 'data não definida';
            const periodoAgendado = user.osEscolhida.melhor_horario_agenda === 'M' ? 'manhã' : 'tarde';
            const diaSemanaAgendado = user.osEscolhida.data_agenda_final ? 
              diaDaSemanaExtenso(user.osEscolhida.data_agenda_final) : '';
            const assunto = user.osEscolhida.titulo || user.osEscolhida.mensagem || `OS ${user.osEscolhida.id}`;
            resposta = `Você selecionou a OS ${user.osEscolhida.id} (${assunto}) que já está agendada para ${diaSemanaAgendado}, dia ${dataAgendada}, no período da ${periodoAgendado}.\n\nO que você gostaria de fazer?`;
            break;
          }

          // Buscar sugestões de agendamento usando a OS completa
          const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida);
          user.sugestoesAgendamento = sugestoes;

          if (!sugestoes || !sugestoes.sugestao) {
            resposta = 'Não há horários disponíveis para agendamento no momento.';
            break;
          }

          // Formatar mensagem amigável com sugestão principal e até 3 alternativas
          const dataSug = sugestoes.sugestao.data;
          const periodoSug = sugestoes.sugestao.periodo;
          const dataFormatada = dayjs(dataSug).format('DD/MM/YYYY');
          const diaSemana = diaDaSemanaExtenso(dataSug);
          const periodoExtenso = periodoSug === 'M' ? 'manhã' : 'tarde';
          const assunto = user.osEscolhida.titulo || user.osEscolhida.mensagem || `OS ${user.osEscolhida.id}`;

          // Alternativas
          let alternativas = '';
          if (sugestoes.alternativas && sugestoes.alternativas.length > 0) {
            // Filtra a sugestão principal para não aparecer nas alternativas
            const principalKey = `${sugestoes.sugestao.data}-${sugestoes.sugestao.periodo}`;
            
            // Agrupa alternativas por data/periodo, evita duplicidade
            const alternativasUnicas = [];
            const seen = new Set([principalKey]); // Inicializa o Set com a sugestão principal para evitar duplicação
            
            for (const alt of sugestoes.alternativas) {
              const key = `${alt.data}-${alt.periodo}`;
              if (!seen.has(key)) {
                alternativasUnicas.push(alt);
                seen.add(key);
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
            `Que tal ${diaSemana}, dia ${dataFormatada}, no período da ${periodoExtenso}?` +
            (alternativas ? `\n\nSe preferir, também tenho:\n${alternativas}` : '') +
            `\n\nEstá bom para você ou prefere outra opção? Se preferir, posso verificar outras datas disponíveis.`;
          break;
        }

        /* --------------------------------------------------------------------
          4.6 EXTRAI DATA
        -------------------------------------------------------------------- */
        case 'extrair_data': {if (!user.clienteId) { break;}
          const dataInterp = await interpretarDataNatural(mensagem, 'default-agent', contexto, 'Frase do usuário: "' + mensagem + '"');
          console.log('dataInterp: ' + dataInterp);

          if (!dataInterp || !dayjs(dataInterp).isValid()) {
            resposta = await gerarMensagemDaIntent({
              intent,
              agentId: 'default-agent',
              dados: contexto,
              promptExtra: 'Data inválida. Informe novamente, por favor.'
            });
            break;
          }

          user.dataInterpretada = dataInterp;
          
          // Verificar se existe uma OS selecionada ou tentar identificar da mensagem
          if (!user.osEscolhida) {
            const verificacao = await verificarOSEscolhida(
              user,
              'Para agendar, preciso saber qual ordem de serviço você deseja.',
              mensagem,
              contexto,
              intent
            );
            
            if (verificacao.osExiste) {
              user.osEscolhida = verificacao.osObj;
              console.log(`OS ${user.osEscolhida.id} identificada no extrair_data`);
            }
          }
          
          // Verificar se é final de semana usando a função verificarDisponibilidade
          if (user.osEscolhida) {
            console.log(`Verificando disponibilidade com verificarDisponibilidade: OS=${user.osEscolhida.id}, Data=${user.dataInterpretada}`);
            const resultadoDisponibilidade = await verificarDisponibilidade(
              user.osEscolhida, 
              user.dataInterpretada, 
              'M' // Verificamos apenas se a data é válida, o período é irrelevante neste ponto
            );
            
            if (resultadoDisponibilidade.ehFinalDeSemana) {
              const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
              const diaSemanaTexto = resultadoDisponibilidade.diaDaSemana;
              resposta = `Desculpe, não realizamos agendamentos para finais de semana. A data ${dataFormatada} é um ${diaSemanaTexto}. Por favor, escolha uma data de segunda a sexta-feira.`;
              // Limpar a data interpretada para que o usuário possa escolher outra
              user.dataInterpretada = null;
              break;
            }
          } else {
            // Se não temos OS escolhida, fazemos a verificação tradicional
            const diaDaSemana = dayjs(user.dataInterpretada).day(); // 0 = domingo, 6 = sábado
            if (diaDaSemana === 0 || diaDaSemana === 6) {
              const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
              const diaSemanaTexto = diaDaSemana === 0 ? 'domingo' : 'sábado';
              resposta = `Desculpe, não realizamos agendamentos para finais de semana. A data ${dataFormatada} é um ${diaSemanaTexto}. Por favor, escolha uma data de segunda a sexta-feira.`;
              // Limpar a data interpretada para que o usuário possa escolher outra
              user.dataInterpretada = null;
              break;
            }
          }

          // Verificar se já temos período e OS para fazer o agendamento
          if (user.periodoAgendamento && user.osList && user.osList.length > 0) {
            // Se o usuário ainda não escolheu uma OS específica, mas só tem uma na lista, usamos ela
            if (!user.osEscolhida && user.osList.length === 1) {
              user.osEscolhida = user.osList[0];
              console.log(`Auto-selecionando a única OS disponível: ${user.osEscolhida.id}`);
            }
            
            // Se temos OS escolhida, data e período, verificamos a disponibilidade
            if (user.osEscolhida) {
              try {
                console.log(`Verificando disponibilidade para: OS=${user.osEscolhida.id}, Data=${user.dataInterpretada}, Período=${user.periodoAgendamento}`);
                
                // Verificar disponibilidade usando a função gerarSugestoesDeAgendamento
                const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida, {
                  dataEspecifica: user.dataInterpretada,
                  periodoEspecifico: user.periodoAgendamento
                });
                
                if (!sugestoes || !sugestoes.sugestao) {
                  // Data/período não disponível
                  const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
                  const periodoExtenso = user.periodoAgendamento === 'M' ? 'manhã' : 'tarde';
                  resposta = `Desculpe, não encontrei disponibilidade para ${dataFormatada} no período da ${periodoExtenso}. Gostaria de tentar outra data ou período?`;
                  break;
                }
                
                // Data/período disponível - pedir confirmação antes de agendar
                const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
                const diaSemana = diaDaSemanaExtenso(user.dataInterpretada);
                const periodoExtenso = user.periodoAgendamento === 'M' ? 'manhã' : 'tarde';
                const assunto = user.osEscolhida.titulo || user.osEscolhida.mensagem || `OS ${user.osEscolhida.id}`;
                
                resposta = `${diaSemana}, ${dataFormatada} pela ${periodoExtenso} está disponível para agendamento da OS ${user.osEscolhida.id} (${assunto}).

Confirma o agendamento para essa data?`;
                
                // Armazenar a sugestão para uso posterior
                user.sugestaoData = user.dataInterpretada;
                user.sugestaoPeriodo = user.periodoAgendamento;
                user.tipoUltimaPergunta = 'AGENDAMENTO';
              } catch (error) {
                console.error('Erro ao verificar disponibilidade:', error);
                resposta = 'Desculpe, ocorreu um erro ao verificar a disponibilidade. Por favor, tente novamente mais tarde.';
              }
            } else {
              // Temos data e período, mas não temos OS escolhida
              resposta = `Entendi que você deseja agendar para ${dayjs(dataInterp).format('DD/MM/YYYY')} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}. Agora preciso saber qual OS você deseja agendar. Por favor, informe o número da OS.`;
            }
          } else {
            // Se não temos período, pedir ao usuário
            resposta = user.periodoAgendamento
              ? `📅 Confirmo ${dayjs(dataInterp).format('DD/MM/YYYY')} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}?`
              : await gerarMensagemDaIntent({
                  intent: 'extrair_hora',
                  agentId: 'default-agent',
                  dados: contexto,
                  promptExtra: 'Agora escolha um período (manhã ou tarde).'
                });
          }
          break;
        }

        /* --------------------------------------------------------------------
          4.7 EXTRAI HORA
        -------------------------------------------------------------------- */
        case 'extrair_hora': {if (!user.clienteId) { break;}
          if (!user.clienteId) {
            resposta = await gerarMensagemDaIntent({
              intent,
              agentId: 'default-agent',
              dados: contexto,
              promptExtra: 'Peça o CPF primeiro.'
            });
            break;
          }

          const periodoInterp = await interpretaPeriodo(mensagem);
          if (!periodoInterp || !['M', 'T'].includes(periodoInterp)) {
            resposta = await gerarMensagemDaIntent({
              intent: 'faltando_hora',
              agentId: 'default-agent',
              dados: contexto,
              promptExtra: 'Período inválido. Tente de novo, por favor.'
            });
            break;
          }

          user.periodoAgendamento = periodoInterp;
          
          // Verificar se existe uma OS selecionada ou tentar identificar da mensagem
          if (!user.osEscolhida) {
            const verificacao = await verificarOSEscolhida(
              user,
              'Para agendar, preciso saber qual ordem de serviço você deseja.',
              mensagem,
              contexto,
              intent
            );
            
            if (verificacao.osExiste) {
              user.osEscolhida = verificacao.osObj;
              console.log(`OS ${user.osEscolhida.id} identificada no extrair_hora`);
            }
          }
          
          // Verificar se já temos data e OS para fazer o agendamento
          if (user.dataInterpretada && user.osList && user.osList.length > 0) {
            // Se o usuário ainda não escolheu uma OS específica, mas só tem uma na lista, usamos ela
            if (!user.osEscolhida && user.osList.length === 1) {
              user.osEscolhida = user.osList[0];
              console.log(`Auto-selecionando a única OS disponível: ${user.osEscolhida.id}`);
            }
            
            // Se temos OS escolhida, data e período, verificamos a disponibilidade
            if (user.osEscolhida) {
              // Verificar se a data e período estão disponíveis
              try {
                console.log(`Verificando disponibilidade para: OS=${user.osEscolhida.id}, Data=${user.dataInterpretada}, Período=${user.periodoAgendamento}`);
                
                // Verificar disponibilidade usando a função verificarDisponibilidade
                console.log(`Verificando disponibilidade com verificarDisponibilidade: OS=${user.osEscolhida.id}, Data=${user.dataInterpretada}, Período=${user.periodoAgendamento}`);
                const resultadoDisponibilidade = await verificarDisponibilidade(
                  user.osEscolhida, 
                  user.dataInterpretada, 
                  user.periodoAgendamento
                );
                
                // Verificar se é final de semana
                if (resultadoDisponibilidade.ehFinalDeSemana) {
                  const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
                  const diaSemanaTexto = resultadoDisponibilidade.diaDaSemana;
                  resposta = `Desculpe, não realizamos agendamentos para finais de semana. A data ${dataFormatada} é um ${diaSemanaTexto}. Por favor, escolha uma data de segunda a sexta-feira.`;
                  // Limpar a data interpretada para que o usuário possa escolher outra
                  user.dataInterpretada = null;
                  break;
                }
                
                // Verificar disponibilidade
                if (!resultadoDisponibilidade.disponivel) {
                  // Data/período não disponível
                  const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
                  const periodoExtenso = user.periodoAgendamento === 'M' ? 'manhã' : 'tarde';
                  
                  // Verificar se existem outros períodos disponíveis para a mesma data
                  if (resultadoDisponibilidade.periodosDisponiveis && resultadoDisponibilidade.periodosDisponiveis.length > 0) {
                    const outrosPeriodos = resultadoDisponibilidade.periodosDisponiveis
                      .map(p => p === 'M' ? 'manhã' : 'tarde')
                      .join(' e ');
                    resposta = `Desculpe, não encontrei disponibilidade para ${dataFormatada} no período da ${periodoExtenso}. Porém, temos disponibilidade no período da ${outrosPeriodos}. Gostaria de agendar nesse período?`;
                  } else {
                    resposta = `Desculpe, não encontrei disponibilidade para ${dataFormatada} no período da ${periodoExtenso}. Gostaria de tentar outra data ou período?`;
                  }
                  break;
                }
                
                // Obter as sugestões para uso posterior
                const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida, {
                  dataEspecifica: user.dataInterpretada,
                  periodoEspecifico: user.periodoAgendamento
                });
                
                // Data/período disponível - pedir confirmação antes de agendar
                const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
                const diaSemana = diaDaSemanaExtenso(user.dataInterpretada);
                const periodoExtenso = user.periodoAgendamento === 'M' ? 'manhã' : 'tarde';
                const assunto = user.osEscolhida.titulo || user.osEscolhida.mensagem || `OS ${user.osEscolhida.id}`;
                
                resposta = `${diaSemana}, ${dataFormatada} pela ${periodoExtenso} está disponível para agendamento da OS ${user.osEscolhida.id} (${assunto}).

Confirma o agendamento para essa data?`;
                
                // Armazenar a sugestão para uso posterior
                user.sugestaoData = user.dataInterpretada;
                user.sugestaoPeriodo = user.periodoAgendamento;
                user.tipoUltimaPergunta = 'AGENDAMENTO';
                
              } catch (error) {
                console.error('Erro ao verificar disponibilidade:', error);
                resposta = 'Desculpe, ocorreu um erro ao verificar a disponibilidade. Por favor, tente novamente mais tarde.';
              }
            } else {
              // Temos data e período, mas não temos OS escolhida
              resposta = `Entendi que você deseja agendar para ${dayjs(user.dataInterpretada).format('DD/MM/YYYY')} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}. Agora preciso saber qual OS você deseja agendar. Por favor, informe o número da OS.`;
            }
          } else {
            // Se não temos data, pedir ao usuário
            resposta = user.dataInterpretada
              ? `📅 Confirmo ${dayjs(user.dataInterpretada).format('DD/MM/YYYY')} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}?`
              : await gerarMensagemDaIntent({
                  intent: 'extrair_data',
                  agentId: 'default-agent',
                  dados: contexto,
                  promptExtra: 'Agora informe a data.'
                });
          }
          break;
        }

        /* --------------------------------------------------------------------
          4.7.1 ALTERAR PERIODO
        -------------------------------------------------------------------- */
        case 'alterar_periodo': {if (!user.clienteId) { break;}

          // Verificar se existe uma OS selecionada ou tentar identificar da mensagem
          const verificacao = await verificarOSEscolhida(
            user, 
            'Ops! Precisamos primeiro selecionar uma OS para alterar o período. Pode me dizer qual OS você deseja?',
            mensagem,
            contexto,
            intent
          );
          if (!verificacao.osExiste) {
            resposta = verificacao.resposta;
            break;
          }

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
          user.sugestoesAgendamento = sugestoes; // Armazena sugestao principal e alternativas

          if (!sugestoes || !sugestoes.sugestao) {
            resposta = `Desculpe, não encontrei disponibilidade para ${dayjs(user.dataInterpretada).format('DD/MM/YYYY')} no período da ${periodoInterp === 'M' ? 'manhã' : 'tarde'}. Gostaria de tentar outra data ou período?`;
            break;
          }

          // Formatar a data e o período para a mensagem usando os valores escolhidos pelo usuário
          const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
          const diaSemana = diaDaSemanaExtenso(user.dataInterpretada);
          const periodoExtenso = user.periodoAgendamento === 'M' ? 'manhã' : 'tarde';
          const assunto = user.osEscolhida.titulo || user.osEscolhida.mensagem || `OS ${user.osEscolhida.id}`;

          resposta = `Ótimo! Confirmando a alteração para ${diaSemana}, dia ${dataFormatada}, no período da ${periodoExtenso}. Posso confirmar o agendamento?`;
          break;
        }

        /* --------------------------------------------------------------------
          4.8 AGENDAR DATA
        -------------------------------------------------------------------- */
        case 'agendar_data': {if (!user.clienteId) { break;}
          
          // Verificar se é um pedido de reagendamento
          const msgLower = mensagem.toLowerCase();
          const isReagendamento = msgLower.includes('reagend') || 
                                msgLower.includes('remarc') || 
                                msgLower.includes('mudar') || 
                                msgLower.includes('alterar') || 
                                msgLower.includes('trocar') || 
                                msgLower.includes('outra data');
          
          // Se for um pedido de reagendamento e a lista de OS estiver vazia, recarregar a lista
          if (isReagendamento && (!user.osList || user.osList.length === 0) && user.clienteId) {
            console.log(`Recarregando lista de OS para o cliente ${user.clienteId} para reagendamento`);
            try {
              // Recarregar a lista de OS do cliente
              const osListAtualizada = await buscarOSPorClienteId(user.clienteId);
              if (osListAtualizada && osListAtualizada.length > 0) {
                user.osList = osListAtualizada;
                console.log(`Lista de OS recarregada com sucesso: ${osListAtualizada.length} OS encontradas`);
              }
            } catch (error) {
              console.error('Erro ao recarregar lista de OS:', error);
            }
          }
          
          // Verificar se existe uma OS selecionada ou tentar identificar da mensagem
          if (!user.osEscolhida) {
            const verificacao = await verificarOSEscolhida(
              user,
              isReagendamento 
                ? 'Para reagendar, preciso saber qual ordem de serviço você deseja modificar.'
                : 'Para agendar, preciso saber qual ordem de serviço você deseja.',
              mensagem,
              contexto,
              intent
            );
            
            if (verificacao.osExiste) {
              user.osEscolhida = verificacao.osObj;
              console.log(`OS ${user.osEscolhida.id} identificada para ${isReagendamento ? 'reagendamento' : 'agendamento'}`);
            }

            if (!user.osEscolhida) {
              let msg = isReagendamento 
                ? 'Para reagendar, preciso saber qual ordem de serviço você deseja modificar. Aqui estão suas OS:'
                : 'Ops! Parece que ainda não selecionamos uma OS. Pode me dizer qual é?';
              if (user.osList && user.osList.length > 0) {
                const abertas = user.osList.filter(os => os.status === 'A');
                const agendadas = user.osList.filter(os => os.status === 'AG');
                if (abertas.length > 0) {
                  msg += '\n\nOS abertas:';
                  abertas.forEach(os => {
                    msg += `\n• ${os.id} - ${os.titulo || os.mensagem || 'Sem descrição'}`;
                  });
                }
                if (agendadas.length > 0) {
                  msg += '\n\nOS agendadas:';
                  agendadas.forEach(os => {
                    msg += `\n• ${os.id} - ${os.titulo || os.mensagem || 'Sem descrição'} (para ${os.data_agenda_final ? dayjs(os.data_agenda_final).format('DD/MM/YYYY [às] HH:mm') : 'data não informada'})`;
                  });
                }
                msg += '\nSe quiser, é só me dizer o número da OS ou a posição na lista! 😊';
              }
              resposta = msg;
              break;
            }
          }

          // NOVO FLUXO: Se já temos a OS escolhida, sugerir imediatamente as datas disponíveis
          if (user.osEscolhida) {
            // Chama gerarSugestoesDeAgendamento para sugerir datas
            const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida);
            user.sugestoesAgendamento = sugestoes;

            if (!sugestoes || !sugestoes.sugestao) {
              resposta = 'Não há horários disponíveis para agendamento no momento.';
              break;
            }

            // Formatar mensagem com sugestão principal e até 3 alternativas
            const dataSug = sugestoes.sugestao.data;
            const periodoSug = sugestoes.sugestao.periodo;
            const dataFormatada = dayjs(dataSug).format('DD/MM/YYYY');
            const diaSemana = diaDaSemanaExtenso(dataSug);
            const periodoExtenso = periodoSug === 'M' ? 'manhã' : 'tarde';
            const assunto = user.osEscolhida.titulo || user.osEscolhida.mensagem || `OS ${user.osEscolhida.id}`;

            // Alternativas
            let alternativas = '';
            if (sugestoes.alternativas && sugestoes.alternativas.length > 0) {
              // Agrupa alternativas por data/periodo, evita duplicidade
              const alternativasUnicas = [];
              const seen = new Set();
              for (const alt of sugestoes.alternativas) {
                const key = `${alt.data}-${alt.periodo}`;
                if (!seen.has(key)) {
                  alternativasUnicas.push(alt);
                  seen.add(key);
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
              `Que tal ${diaSemana}, dia ${dataFormatada}, no período da ${periodoExtenso}?` +
              (alternativas ? `\n\nSe preferir, também tenho:\n${alternativas}` : '') +
              `\n\nEstá bom para você ou prefere outra opção? Se preferir, posso verificar outras datas disponíveis.`;
            break;
          }

          // Fluxo antigo se não houver OS escolhida (deve ser raro)
          if (!user.osEscolhida || !user.dataInterpretada || !user.periodoAgendamento) {
            resposta = await gerarMensagemDaIntent({
              intent,
              agentId: 'default-agent',
              dados: contexto,
              promptExtra: 'Faltam OS, data ou período para agendar.'
            });
            break;
          }

          user.aguardandoConfirmacaoDeAgendamento = true;
          resposta = `Confirma agendar a OS ${user.osEscolhida.id} para ${dayjs(user.dataInterpretada).format('DD/MM/YYYY')} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}?`;
          break;
        }
        /* --------------------------------------------------------------------
        4.8 AGENDAR OUTRA DATA
      -------------------------------------------------------------------- */
        case 'agendar_outra_data': {if (!user.clienteId) { break;}

          if (!user.clienteId) {
           break;
          }

          // Verificar se existe uma OS selecionada
          const verificacao = await verificarOSEscolhida(user);
          if (!verificacao.osExiste) {
            let msg = 'Ops! Parece que ainda não selecionamos uma OS. Pode me dizer qual é?';
            if (user.osList && user.osList.length > 0) {
              const abertas = user.osList.filter(os => os.status === 'A');
              const agendadas = user.osList.filter(os => os.status === 'AG');
              if (abertas.length > 0) {
                msg += '\n\nOS abertas:';
                abertas.forEach(os => {
                  msg += `\n• ${os.id} - ${os.titulo || os.mensagem || 'Sem descrição'}`;
                });
              }
              if (agendadas.length > 0) {
                msg += '\n\nOS agendadas:';
                agendadas.forEach(os => {
                  msg += `\n• ${os.id} - ${os.titulo || os.mensagem || 'Sem descrição'} (para ${os.data_agenda_final ? dayjs(os.data_agenda_final).format('DD/MM/YYYY [às] HH:mm') : 'data não informada'})`;
                });
              }
              msg += '\nSe quiser, é só me dizer o número da OS ou a posição na lista! 😊';
            }
            resposta = msg;
            break;
          }

          if (!!user.dataInterpretada || !!user.periodoAgendamento) {
            user.periodoAgendamento = null; // Limpa o período anterior
            user.dataInterpretada = null; // Limpa a data anterior
          }

          resposta = await gerarMensagemDaIntent({
            intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Faltam OS, data ou período para agendar.'
          });

          if (!user.osEscolhida || !user.dataInterpretada || !user.periodoAgendamento) {
            resposta = await gerarMensagemDaIntent({
              intent,
              agentId: 'default-agent',
              dados: contexto,
              promptExtra: 'Faltam OS, data ou período para agendar.'
            });
            break;
          }

          user.aguardandoConfirmacaoDeAgendamento = true;
          resposta = `Confirma agendar a OS ${user.osEscolhida.id} para ${dayjs(user.dataInterpretada).format('DD/MM/YYYY')} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}?`;
          break;
        }

        /* --------------------------------------------------------------------
          4.9 CONSULTAR DISPONIBILIDADE DATA
        -------------------------------------------------------------------- */
        case 'consultar_disponibilidade_data': {if (!user.clienteId) { break;}
          // Verificar se existe uma OS selecionada ou tentar identificar da mensagem
          const verificacao = await verificarOSEscolhida(
            user,
            null,
            mensagem,
            contexto,
            intent
          );
          if (!verificacao.osExiste) {
            resposta = await gerarMensagemDaIntent({
              intent: 'aleatorio',
              agentId: 'default-agent',
              dados: contexto,
              promptExtra: 'O usuário precisa escolher uma OS antes de consultar disponibilidade.'
            });
            break;
          }
          
          const dataInterp = await interpretarDataNatural(mensagem, 'default-agent', contexto, 'Frase do usuário: "' + mensagem + '"');
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
              const diaSemana = diaDaSemanaExtenso(dataObj.day());
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
            const diaSemana = diaDaSemanaExtenso(dataObj.day());
            
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
            const diaSemana = diaDaSemanaExtenso(dataObj.day());
            
            resposta = `Encontrei disponibilidade para ${diaSemana}, dia ${dataObj.format('DD/MM/YYYY')}, nos seguintes períodos: ` +
              `${periodosDisponiveis.join(' e ')}. Qual período você prefere?`;
          }
          
          break;
        }
      
        /* --------------------------------------------------------------------
          4.9 CONFIRMAR AGENDAMENTO
        -------------------------------------------------------------------- */
        case 'confirmar_agendamento': {if (!user.clienteId) { break;}
          
          console.log("================== user.osEscolhida ==================")  
          console.log("==================" + user.clienteId + "=============================")
          console.log("==================" + !user.clienteId + "=============================")
          if (!user.clienteId) {
            resposta = await gerarMensagemDaIntent({
              intent,
              agentId: 'default-agent',
              dados: contexto,
              promptExtra: 'Peça o CPF primeiro.'
            });
            break;
          }
          console.log("================== user.osEscolhida ==================")  
          console.log("==================" + user.osEscolhida + "=============================")
          console.log("==================" + !user.osEscolhida + "=============================")
          // Verificar se existe uma OS selecionada ou tentar identificar da mensagem
          const verificacao = await verificarOSEscolhida(
            user,
            null,
            mensagem,
            contexto,
            intent
          );
          if (!verificacao.osExiste) {
            // Mostrar lista de OS disponíveis
            let msg = 'Ops! Parece que ainda não selecionamos uma OS. Pode me dizer qual é?';
            if (user.osList && user.osList.length > 0) {
              const abertas = user.osList.filter(os => os.status === 'A');
              const agendadas = user.osList.filter(os => os.status === 'AG');
              if (abertas.length > 0) {
                msg += '\n\nOS abertas:';
                abertas.forEach(os => {
                  msg += `\n• ${os.id} - ${os.titulo || os.mensagem || 'Sem descrição'}`;
                });
              }
              if (agendadas.length > 0) {
                msg += '\n\nOS agendadas:';
                agendadas.forEach(os => {
                  msg += `\n• ${os.id} - ${os.titulo || os.mensagem || 'Sem descrição'} (para ${os.data_agenda_final ? dayjs(os.data_agenda_final).format('DD/MM/YYYY [às] HH:mm') : 'data não informada'})`;
                });
              }
              msg += '\nSe quiser, é só me dizer o número da OS ou a posição na lista! 😊';
            }
            resposta = msg;
            break;
          }

          // Verificar se temos dados de data/período na etapa anterior (caso o usuário tenha escolhido outra data/período)
          // Manter a data e período escolhidos pelo usuário se já existirem
          // Tentar interpretar a mensagem para extrair data ou período, se algum estiver faltando
          if (!user.dataInterpretada || !user.periodoAgendamento) {
            let interpretado = null;
            // Se não temos ambos, tenta extrair da mensagem
            interpretado = await interpretaDataePeriodo({
              mensagem,
              agentId: 'default-agent',
              dados: contexto,
              promptExtra: 'Tente identificar data e/ou período para o agendamento.'
            });
            if (interpretado) {
              if (interpretado.data_interpretada) user.dataInterpretada = interpretado.data_interpretada;
              if (interpretado.periodo_interpretado) user.periodoAgendamento = interpretado.periodo_interpretado;
            }
          }
          
          // Tenta preencher com sugestão prévia se ainda faltar algum
          if ((!user.dataInterpretada || !user.periodoAgendamento) && user.sugestaoData && user.sugestaoPeriodo) {
            if (!user.dataInterpretada) user.dataInterpretada = user.sugestaoData;
            if (!user.periodoAgendamento) user.periodoAgendamento = user.sugestaoPeriodo;
          }
          // Agora, decide o que pedir para o usuário
          if (!user.dataInterpretada && !user.periodoAgendamento) {
            resposta = 'Preciso que você me informe a data e o período para agendarmos.';
            break;
          }
          if (!user.dataInterpretada) {
            resposta = 'Qual data você prefere para o agendamento?';
            break;
          }
          if (!user.periodoAgendamento) {
            resposta = `Para o dia ${dayjs(user.dataInterpretada).format('DD/MM/YYYY')}, você prefere manhã ou tarde?`;
            break;
          }

          // Se passou aqui, temos tudo: OS + data + período
          // Definir horário padrão com base no período (manhã = 09:00:00, tarde = 14:00:00)
          const horarioPadrao = user.periodoAgendamento === 'M' ? '09:00:00' : '14:00:00';
          const dataAgendamento = `${user.dataInterpretada} ${horarioPadrao}`; // Formato: YYYY-MM-DD HH:MM:SS
          
          // Criar o payload com os dados básicos - a função atualizarOS vai calcular as datas corretas
          const payload = {
           ...user.osEscolhida,
             data_agenda_final: dataAgendamento, // Formato correto: YYYY-MM-DD HH:MM:SS
            melhor_horario_agenda: user.periodoAgendamento // Usar o período escolhido (M ou T)
          };
          
          console.log(`Enviando agendamento: OS=${user.osEscolhida.id}, Data=${dataAgendamento}, Período=${user.periodoAgendamento}`);

          const resultado = await atualizarOS(user.osEscolhida.id, payload);
          console.log('resultado: ' + JSON.stringify(resultado));
          
          // Verificar se houve erro no agendamento
          if (resultado?.detalhes?.type === 'error') {
            // Tratar erros comuns de forma amigável
            if (resultado.detalhes.message.includes('Data de fim deve ser maior')) {
              resposta = `Ops! Tive um probleminha técnico ao agendar sua visita. Estou anotando isso e vou resolver. Por favor, tente novamente daqui a pouco ou entre em contato com nosso suporte.`;
              console.error('Erro de data_final:', resultado.detalhes.message);
            } else {
              // Mensagem genérica para outros erros
              resposta = `Desculpe, não consegui agendar sua visita neste momento. Erro: ${resultado.detalhes.message}. Por favor, tente novamente mais tarde.`;
            }
          } else if (resultado?.mensagem && resultado.mensagem.includes('Falha')) {
            // Tratar mensagens de falha de forma amigável
            resposta = `Ops! Tive um probleminha ao agendar sua visita. Por favor, tente novamente daqui a pouco ou entre em contato com nosso suporte.`;
            console.error('Falha no agendamento:', resultado.mensagem);
          } else if (user.osEscolhida && user.dataInterpretada && user.periodoAgendamento) {
            const assunto = user.osEscolhida.titulo || user.osEscolhida.mensagem || `OS ${user.osEscolhida.id}`;
            const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
            const diaSemana = diaDaSemanaExtenso(user.dataInterpretada);
            resposta = `Prontinho! Sua visita para ${assunto} está agendada! Ficou para ${diaSemana}, dia ${dataFormatada} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}. Estou finalizando nosso atendimento. Caso precise de mim, estou por aqui.`;
          } else {
            resposta = `✅ Agendado para ${dayjs(user.dataInterpretada).format('DD/MM/YYYY')} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}.`;
          }

          console.log('antes de agendar: LOG ESTADO ');
          /* ----------- LOG COMPLETO DO ESTADO ANTES DE RESPONDER --------- */
          logEstado({ numero, user, intent, resposta });
          // Limpa o contexto do usuário, mantendo apenas cpf, clienteId e numero
          Object.keys(user).forEach(key => {
            if (!['cpf', 'clienteId', 'numero', 'nomeCliente'].includes(key)) {
              delete user[key];
            }
          });

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

        /* --------------------------------------------------------------------
          4.10 MAIS DETALHES
        -------------------------------------------------------------------- */
        case 'mais_detalhes': {if (!user.clienteId) { break;}
          if (!user.osList || user.osList.length === 0) {
            resposta = 'Ops! Parece que não temos nenhuma OS aberta. Tente novamente mais tarde.';
            break;
          }
          
          // Verificar se já existe uma OS selecionada
          const verificacao = await verificarOSEscolhida(user, null);
          if (verificacao.osExiste) {
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
          • Assunto: ${os.titulo || os.mensagem || 'Sem descrição'}
          • Status: ${os.status === 'AG' ? 'Agendada' : os.status === 'A' ? 'Aberta' : os.status}
          ${dataFormatada ? `• Data agendada: ${dataFormatada}\n` : ''}${os.endereco ? `• Endereço: ${os.endereco}\n` : ''}Se precisar de mais alguma coisa, é só me chamar! 😊`;
            
            Object.keys(user).forEach(key => {
              if (!['cpf', 'clienteId', 'numero', 'nomeCliente'].includes(key)) {
                delete user[key];
              }
            });
            break;
          }

          const idInterpretado = await interpretarNumeroOS({
            mensagem,
            agentId: 'default-agent',
            dados: contexto,
            osList: user.osList,
            promptExtra: 'tente identificar o id da os.'
          });
          const osObj = user.osList.find(o => o.id === idInterpretado);

          console.log('idInterpretado:', idInterpretado);

          if (osObj) {
            user.osEscolhida = osObj;
            // Monta detalhes da OS escolhida (exemplo básico, pode customizar)
            const os = user.osEscolhida;
            // Formatar a data no padrão solicitado: dia DD do mês de (mês) no período da manhã/tarde
            let dataFormatada = null;
            if (os.data_agenda_final && os.data_agenda_final !== '0000-00-00 00:00:00') {
              const dataObj = dayjs(os.data_agenda_final);
              const dia = dataObj.format('DD');
              const mes = dataObj.format('MMMM'); // Nome do mês por extenso
              const periodo = os.melhor_horario_agenda === 'M' ? 'manhã' : 'tarde';
              dataFormatada = `dia ${dia} do mês de ${mes} no período da ${periodo}`;
            }
            resposta = `Opa! Prontinho! Aqui estão os detalhes da sua OS ${os.id}:
          • Assunto: ${os.titulo || os.mensagem || 'Sem descrição'}
          • Status: ${os.status === 'AG' ? 'Agendada' : os.status === 'A' ? 'Aberta' : os.status}
          ${dataFormatada ? `• Data agendada: ${dataFormatada}\n` : ''}${os.endereco ? `• Endereço: ${os.endereco}\n` : ''}Se precisar de mais alguma coisa, é só me chamar! 😊`;
          } else {
            resposta = 'Não consegui encontrar a OS que você está procurando. Aqui estão as opções disponíveis:';
            const opcoes = user.osList.map(os => `OS ${os.id} - ${os.titulo || os.mensagem || 'Sem descrição'}`);
            resposta += '\n' + opcoes.join('\n');
          }

          Object.keys(user).forEach(key => {
            if (!['cpf', 'clienteId', 'numero', 'nomeCliente'].includes(key)) {
              delete user[key];
            }
          });
          break;
        }

        /* --------------------------------------------------------------------
          4.5.1 CONFIRMAR ESCOLHA OS
        -------------------------------------------------------------------- */
        case 'confirmar_escolha_os': {if (!user.clienteId) { break;}
          // Verificar se existe uma OS selecionada
          const verificacao = await verificarOSEscolhida(user, null, mensagem, contexto, intent);
          if (!verificacao.osExiste) {
            // Tenta pegar a última OS apresentada ao usuário
            if (user.osList && user.osList.length === 1) {
              user.osEscolhida = user.osList[0];
            } else {
              resposta = 'Qual ordem de serviço você deseja agendar? Informe o número ou a posição na lista.';
              break;
            }
          }

          // Sugerir datas disponíveis para a OS escolhida, se possível
          const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida);
          if (sugestoes && sugestoes.sugestao) {
            user.sugestaoData = sugestoes.sugestao.data;
            user.sugestaoPeriodo = sugestoes.sugestao.periodo;
            const dataFormatada = dayjs(sugestoes.sugestao.data).format('DD/MM/YYYY');
            const diaSemana = diaDaSemanaExtenso(sugestoes.sugestao.data);
            const periodoExtenso = sugestoes.sugestao.periodo === 'M' ? 'manhã' : 'tarde';
            const assunto = user.osEscolhida.titulo || user.osEscolhida.mensagem || `OS ${user.osEscolhida.id}`;
            resposta = `Perfeito! Vamos agendar a visita para a OS ${user.osEscolhida.id} (${assunto}).\nSe preferir, tenho uma sugestão: ${diaSemana}, dia ${dataFormatada}, no período da ${periodoExtenso}.\nSe quiser outra data ou período, é só me informar! Qual data e período você prefere?`;
          } else {
            resposta = `Perfeito! Vamos agendar a visita para a OS ${user.osEscolhida.id}. Por favor, informe a data e o período (manhã ou tarde) que você prefere, e faremos o possível para atender sua solicitação!`;
          }
          // Atualiza etapa para esperar data/período
          user.etapaAnterior = user.etapaAtual;
          user.etapaAtual = 'agendar_data';
          break;
        }

        /* --------------------------------------------------------------------
          4.10 FINALIZADO
        -------------------------------------------------------------------- */
        case 'finalizado':
        default: {
          resposta = await gerarMensagemDaIntent({
            intent: 'finalizado',
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Encerrar atendimento.'
          });
          // Limpar todas as variáveis do usuário antes de resetar a sessão
          usuarios[numero] = {
            etapa: 'inicio',
            etapaAnterior: '',
            etapaAtual: 'inicio',
            mensagemAnteriorGPT: '',
            mensagemAnteriorCliente: '',
            cpf: null,
            clienteId: null,
            nomeCliente: null,
            osList: [],
            osEscolhida: null,
            dataInterpretada: null,
            periodoAgendamento: null,
            sugestaoData: null,
            sugestaoHora: null,
          };
          break;
        }
      } // fim switch
   
      if (!user.cpf) {
      resposta = await gerarMensagemDaIntent({
        intent,
        agentId: 'default-agent',
        dados: contexto,
        promptExtra: 'Peça o CPF primeiro.'
      });
    }
    /* -------------------- 5. Fallback ------------------------------ */
    if (!resposta) resposta = 'Desculpe, não consegui entender. Pode tentar novamente?';

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

    await enviarMensagemWhatsApp(messageData);
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
          body: 'Desculpe, ocorreu um erro interno ao processar sua solicitação. Tente novamente mais tarde.'
        });
      }
    } catch (sendError) {
      console.error('Erro ao enviar mensagem de erro para o usuário:', sendError);
    }
    res.status(500).send('Erro interno do servidor');
  }
});

module.exports = router;
