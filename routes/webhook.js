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
  gerarSugestoesDeAgendamento
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
    const dataInterp = await interpretarDataNatural(mensagem);
    console.log('====== DATA INTERPRETADA: ======');
    console.log(dataInterp);
    console.log('===============================')

    // Se não encontrou data válida, retorna null
    if (!dataInterp || !dayjs(dataInterp).isValid()) {
      return null;
    }

    // Tenta extrair o período da mensagem
    const periodoInterp = await interpretaPeriodo(mensagem);

    // Retorna objeto com data e período
    return {
      data_interpretada: dataInterp,
      periodo_interpretado: periodoInterp || 'T' // Default para tarde se não encontrou período
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

  let mensagem = req.body.Body?.trim() ?? '';
  const numero = req.body.From;
  const audioUrl = req.body.MediaUrl0;
  // const audioType = req.body.MediaContentType0; // Poderia ser usado para validar o tipo se necessário

  // Suporte para Payload aninhado (caso venha como string JSON)
  // Esta lógica pode ser necessária dependendo de como o Twilio Studio/Flex envia os dados
  // if (req.body.Payload) {
  //   try {
  //     const payloadObj = JSON.parse(req.body.Payload);
  //     const params = payloadObj?.webhook?.request?.parameters;
  //     if (params) {
  //       mensagem = params.Body || mensagem;
  //       // audioUrl = params.MediaUrl0 || audioUrl;
  //       // audioType = params.MediaContentType0 || audioType;
  //     }
  //   } catch (e) {
  //     console.error('[Webhook Unificado] Erro ao parsear Payload:', e);
  //   }
  // }

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

  // Se mesmo após tentativa de transcrição, a mensagem estiver vazia, define uma padrão.
  if (!mensagem) {
    console.log('[Webhook Unificado] Nenhuma mensagem de texto ou áudio válido recebido. Usando mensagem padrão.');
    mensagem = 'Não entendi o que você disse ou enviou.'; 
    // Considerar se uma resposta deve ser enviada ou apenas logar e retornar 200 OK
    // Se for para responder, a lógica abaixo cuidará disso.
  }

  /* -------------------- 1. Recupera/Cria sessão ------------------- */
  const user = usuarios[numero] ?? {
    etapa: 'inicio', etapaAnterior: '', etapaAtual: 'inicio',
    mensagemAnteriorGPT: '', mensagemAnteriorCliente: '',
    cpf: null, clienteId: null, nomeCliente: null,
    osList: [], osEscolhida: null,           // osEscolhida é SEMPRE objeto
    dataInterpretada: null, periodoAgendamento: null
  };

  /* -------------------- 2. Gera contexto p/ LLM ------------------- */
  const dados = geraDados(user, mensagem);
  const contexto = gerarPromptContextualizado(dados);
  let resposta = '';

  try {
    /* -------------------- 3. Detecta INTENT ----------------------- */
    const { intent } = await detectarIntentComContexto({
      mensagem, // Usa a mensagem (texto original ou transcrito)
      agentId: 'default-agent',
      promptExtra: contexto,
      intentAnterior: user.etapaAnterior,
      mensagemAnteriorGPT: user.mensagemAnteriorGPT
    });

    user.etapaAtual = intent;

    console.log("================== Nova Intent Detectada ==================")
    console.log("==================" + intent + "=============================")
    console.log("================== Nova Intent Detectada ==================")

    /* -------------------- 4. Fluxo principal ---------------------- */
    switch (intent) {
      /* --------------------------------------------------------------------
         4.X RECUSAR/CANCELAR
      -------------------------------------------------------------------- */
      case 'recusar_cancelar': {
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
      case 'mudar_de_os': {
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
      case 'listar_opcoes': {
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
      /* --------------------------------------------------------------------
         4.1 INICIO
      -------------------------------------------------------------------- */
      case 'inicio': {
        resposta = await gerarMensagemDaIntent({
          intent,
          agentId: 'default-agent',
          dados: contexto,
          promptExtra: user.cpf ? 'Não solicite o CPF.' : 'Peça o CPF para iniciar.'
        });
        break;
      }

      /* --------------------------------------------------------------------
         4.2 ALEATORIO
      -------------------------------------------------------------------- */
      case 'aleatorio': {
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
         4.3 EXTRAI CPF
      -------------------------------------------------------------------- */
      case 'extrair_cpf': {
        const cpf = extrairCpf(mensagem);
        if (!cpf) { resposta = 'CPF inválido, pode enviar novamente?'; break; }

        user.cpf = cpf;
        const cliente = await buscarClientePorCpf(cpf);
        if (!cliente?.cliente?.id) { resposta = 'CPF não encontrado. Pode reenviar?'; break; }

        user.clienteId = cliente.cliente.id;
        user.nomeCliente = cliente.cliente.razao;

        const lista = await buscarOSPorClienteId(user.clienteId);
        const osAbertas = lista.filter(o => o.status === 'A');
        const osAgendadas = lista.filter(o => o.status === 'AG');
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
        break;
      }

      /* --------------------------------------------------------------------
         4.4 VERIFICAR OS
      -------------------------------------------------------------------- */
      case 'verificar_os': {
        if (!user.clienteId) {
          resposta = await gerarMensagemDaIntent({
            intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Peça o CPF primeiro.'
          });
          break;
        }

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
      case 'escolher_os': {
        if (!user.clienteId) {
          resposta = await gerarMensagemDaIntent({
            intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Peça o CPF primeiro.'
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

        if (!osObj) {
          resposta = await gerarMensagemDaIntent({
            intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: `IMPORTANTE – A OS informada NÃO foi encontrada. 
            • Peça novamente o número da OS OU sugira dizer “primeira”, “segunda”… se estiver listada.
            • NÃO diga que o agendamento foi concluído.`
          });
          break;
        }

        // Define a OS escolhida
        user.osEscolhida = osObj;

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

      case 'datas_disponiveis': {
        if (!user.clienteId) {
          resposta = await gerarMensagemDaIntent({
            intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Peça o CPF primeiro.'
          });
          break;
        }

        // Recomenda até 3 datas disponíveis distintas
        if (!user.datasDisponiveis || user.datasDisponiveis.length === 0) {
          resposta = 'Não há horários disponíveis para agendamento no momento.';
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
          const assunto = user.osEscolhida.titulo || user.osEscolhida.mensagem || `OS ${user.osEscolhida.id}`;
          
          resposta = `Você selecionou a OS ${user.osEscolhida.id} (${assunto}) que já está agendada para ${diaSemanaAgendado}, ` +
                    `dia ${dataAgendada}, no período da ${periodoAgendado}.\n\n` +
                    `O que você gostaria de fazer?\n` +
                    `1. Ver mais detalhes desta OS\n` +
                    `2. Reagendar esta visita\n` +
                    `3. Voltar para a lista de OS`;
        } else {
          // OS está aberta (status = 'A') - seguir com o fluxo normal de agendamento
          const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida);
          user.sugestaoData = sugestoes.sugestao.data;
          user.sugestaoPeriodo = sugestoes.sugestao.periodo; // Armazena o período (M/T) em vez do horário

          // Formatar a data e o período para a mensagem
          const dataFormatada = dayjs(sugestoes.sugestao.data).format('DD/MM/YYYY');
          const diaSemana = diaDaSemanaExtenso(sugestoes.sugestao.data);
          const periodoExtenso = sugestoes.sugestao.periodo === 'M' ? 'manhã' : 'tarde';
          const assunto = user.osEscolhida.titulo || user.osEscolhida.mensagem || `OS ${user.osEscolhida.id}`;
          
          resposta = `Ótimo! Tenho uma sugestão para sua visita de ${assunto}! ` +
                    `Que tal ${diaSemana}, dia ${dataFormatada}, no período da ${periodoExtenso}?\n\n` +
                    `Está bom para você ou prefere outra opção? Se preferir, posso verificar outras datas disponíveis.`;
        }
        break;
      }

      /* --------------------------------------------------------------------
         4.6 EXTRAI DATA
      -------------------------------------------------------------------- */
      case 'extrair_data': {
        if (!user.clienteId) {
          resposta = await gerarMensagemDaIntent({
            intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Peça o CPF primeiro.'
          });
          break;
        }

        const dataInterp = await interpretarDataNatural(mensagem);
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
        resposta = user.periodoAgendamento
          ? `📅 Confirmo ${dayjs(dataInterp).format('DD/MM/YYYY')} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}?`
          : await gerarMensagemDaIntent({
            intent: 'extrair_hora',
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Agora escolha um período (manhã ou tarde).'
          });
        break;
      }

      /* --------------------------------------------------------------------
         4.7 EXTRAI HORA
      -------------------------------------------------------------------- */
      case 'extrair_hora': {
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
        resposta = user.dataInterpretada
          ? `📅 Confirmo ${dayjs(user.dataInterpretada).format('DD/MM/YYYY')} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}?`
          : await gerarMensagemDaIntent({
            intent: 'extrair_data',
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Agora informe a data.'
          });
        break;
      }

      /* --------------------------------------------------------------------
         4.7.1 ALTERAR PERIODO
      -------------------------------------------------------------------- */
      case 'alterar_periodo': {
        if (!user.clienteId) {
          resposta = await gerarMensagemDaIntent({
            intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Peça o CPF primeiro.'
          });
          break;
        }

        if (!user.osEscolhida) {
          resposta = 'Ops! Precisamos primeiro selecionar uma OS para alterar o período. Pode me dizer qual OS você deseja?';
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

        if (!sugestoes || !sugestoes.sugestao) {
          resposta = `Desculpe, não encontrei disponibilidade para ${dayjs(user.dataInterpretada).format('DD/MM/YYYY')} no período da ${periodoInterp === 'M' ? 'manhã' : 'tarde'}. Gostaria de tentar outra data ou período?`;
          break;
        }

        // Armazenar a sugestão para uso posterior
        user.sugestaoData = sugestoes.sugestao.data;
        user.sugestaoPeriodo = sugestoes.sugestao.periodo;

        // Formatar a data e o período para a mensagem
        const dataFormatada = dayjs(sugestoes.sugestao.data).format('DD/MM/YYYY');
        const diaSemana = diaDaSemanaExtenso(sugestoes.sugestao.data);
        const periodoExtenso = sugestoes.sugestao.periodo === 'M' ? 'manhã' : 'tarde';
        const assunto = user.osEscolhida.titulo || user.osEscolhida.mensagem || `OS ${user.osEscolhida.id}`;

        resposta = `Ótimo! Confirmando a alteração para ${diaSemana}, dia ${dataFormatada}, no período da ${periodoExtenso}. Posso confirmar o agendamento?`;
        break;
      }

      /* --------------------------------------------------------------------
         4.8 AGENDAR DATA
      -------------------------------------------------------------------- */
      case 'agendar_data': {
        if (!user.clienteId) {
          resposta = await gerarMensagemDaIntent({
            intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Peça o CPF primeiro.'
          });
          break;
        }
        
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
        
        if (!user.osEscolhida) {
          // Se for reagendamento, pular a tentativa de interpretar a OS e mostrar as opções diretamente
          if (isReagendamento) {
            // Tentar extrair o número da OS da mensagem
            const osPattern = /\b(\d{4,6})\b/; // Padrão para encontrar números de 4-6 dígitos (formato típico de OS)
            const osMatch = mensagem.match(osPattern);
            
            if (osMatch && user.osList && user.osList.length > 0) {
              const osIdExtraido = osMatch[1];
              console.log(`Número de OS extraído da mensagem de reagendamento: ${osIdExtraido}`);
              
              // Verificar se a OS existe na lista do usuário
              const osEncontrada = user.osList.find(os => os.id === osIdExtraido);
              if (osEncontrada) {
                user.osEscolhida = osEncontrada;
                console.log(`OS ${osIdExtraido} encontrada para reagendamento: ${JSON.stringify(osEncontrada)}`);
              }
            }
          } else {
            // Tenta interpretar a OS normalmente
            const posicao = await interpretarEscolhaOS({
              mensagem,
              osList: user.osList,
              agentId: 'default-agent',
              dados: contexto,
              promptExtra: 'tente identificar a escolha da OS.'
            });
            if (posicao && user.osList && user.osList[posicao - 1]) {
              user.osEscolhida = user.osList[posicao - 1];
            }
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

        if (!user.dataInterpretada || !user.periodoAgendamento) {
          // Tentamos interpretar a nova mensagem para buscar data/hora
          const interpretado = await interpretaDataePeriodo({
            mensagem,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Tente identificar data e hora para o agendamento.'
          });

          if (interpretado?.data_interpretada && interpretado?.periodo_interpretado) {
            user.dataInterpretada = interpretado.data_interpretada;
            user.periodoAgendamento = interpretado.periodo_interpretado;
          }
        }

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
      case 'agendar_outra_data': {

        if (!user.clienteId) {
          resposta = await gerarMensagemDaIntent({
            intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Peça o CPF primeiro.'
          });
          break;
        }

        if (!user.osEscolhida) {
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
         4.9 CONFIRMAR AGENDAMENTO
      -------------------------------------------------------------------- */
      case 'confirmar_agendamento': {
        if (!user.clienteId) {
          resposta = await gerarMensagemDaIntent({
            intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Peça o CPF primeiro.'
          });
          break;
        }

        if (!user.osEscolhida) {
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
      case 'mais_detalhes': {
        if (!user.osList || user.osList.length === 0) {
          resposta = 'Ops! Parece que não temos nenhuma OS aberta. Tente novamente mais tarde.';
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
         4.11 FINALIZADO / DEFAULT
      -------------------------------------------------------------------- */
      case 'finalizado':
      default: {
        if (!user.clienteId) {
          resposta = await gerarMensagemDaIntent({
            intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Peça o CPF primeiro para iniciar.'
          });
          break;
        }

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

    /* -------------------- 5. Fallback ------------------------------ */
    if (!resposta) resposta = 'Desculpe, não consegui entender. Pode tentar novamente?';

    /* ----------- LOG COMPLETO DO ESTADO ANTES DE RESPONDER --------- */
    logEstado({ numero, user, intent, resposta });

    /* -------------------- 6. Persistência sessão ------------------- */
    user.etapaAnterior = user.etapaAtual || 'inicio'; // <- guarda o que era
    user.etapaAtual = intent;                      // <- atualiza para a nova intent
    user.mensagemAnteriorGPT = resposta;
    user.mensagemAnteriorCliente = mensagem;
    usuarios[numero] = user;

    /* -------------------- 7. Envia WhatsApp ------------------------ */
    const twilioWhatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
    if (!twilioWhatsappNumber) {
      console.error('❌ ERRO FATAL: Variável de ambiente TWILIO_WHATSAPP_NUMBER não definida!');
      // Não podemos enviar resposta sem o número de origem
      return res.status(500).send('Erro de configuração do servidor: TWILIO_WHATSAPP_NUMBER não definido.');
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
