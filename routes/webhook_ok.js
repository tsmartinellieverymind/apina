const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { diaDaSemanaExtenso } = require('../app/utils/dateHelpers');
const { logEstado } = require('../app/utils/logger');

/* ---------------------------------------------------------
   Configurações
--------------------------------------------------------- */
const boolSalvarConversa = false; // toggle para gravar no MongoDB

/* ---------------------------------------------------------
   Serviços externos
--------------------------------------------------------- */
const { enviarMensagemWhatsApp } = require('../services/twillioService');
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
router.post('/', async (req, res) => {
  const mensagem = req.body.Body?.trim() ?? '';
  const numero = req.body.From;

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
      mensagem,
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
        // Limpa variáveis relacionadas ao fluxo
        user.osEscolhida = null;
        user.dataInterpretada = null;
        user.periodoAgendamento = null;
        user.etapaAtual = 'escolher_os';
        user.etapaAnterior = '';
        resposta = 'Sem problemas! Vamos escolher uma nova ordem de serviço para agendar. Por favor, me diga qual OS você deseja e depois selecione uma nova data para o agendamento.';
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
        resposta = `Aqui estão as opções disponíveis:\n\nOrdens de Serviço (OS):\n${osMsg}\n\nDatas e períodos sugeridos:\n${datasMsg}\n\nSe quiser escolher uma OS, basta me dizer o número. Para agendar, é só informar a data e o período (manhã ou tarde) que preferir!`;
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

        // Sugere data + horário com base no SLA (72h por padrão)
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
        user.sugestaoHora = sugestoes.sugestao.horario;
        user.tipoUltimaPergunta = 'AGENDAMENTO';

        // Agrupa alternativas por data e limita a 3 horários distintos por dia
        const alternativasPorDia = {};
        for (const alt of sugestoes.alternativas) {
          if (!alternativasPorDia[alt.data]) alternativasPorDia[alt.data] = [];
          // Só adiciona se ainda não atingiu 3 horários distintos para o dia
          if (alternativasPorDia[alt.data].length < 3 && !alternativasPorDia[alt.data].some(h => h === alt.horario)) {
            alternativasPorDia[alt.data].push(alt.horario);
          }
        }
        // Monta lista final de alternativas (data + horário, sem técnico)
        const alternativasFormatadas = [];
        Object.entries(alternativasPorDia).forEach(([data, horarios]) => {
          horarios.forEach(horario => {
            alternativasFormatadas.push(`${dayjs(data).format('DD/MM/YYYY')} às ${horario}`);
          });
        });
        // Limita o total de alternativas exibidas (opcional, pode limitar a 10 por exemplo)
        const alternativasExibir = alternativasFormatadas.slice(0, 10);

        resposta = `Certo! Temos um ótimo horario para você! Podemos agendar a OS ${osObj.id} para ${dayjs(sugestoes.sugestao.data).format('DD/MM/YYYY')} às ${sugestoes.sugestao.horario}.\n` +
          `\nEstá ok pra você ou prefere outro horário? Se preferir me peça mais opções de horario.`;
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
        // Seleciona até 3 alternativas distintas de data+horário
        const alternativasExibir = user.datasDisponiveis.slice(0, 3);
        resposta = `Aqui estão ${alternativasExibir.length} horários disponíveis para agendamento:\n` +
          alternativasExibir.map((a, idx) => `${idx + 1}. ${dayjs(a.data).format('DD/MM/YYYY')} às ${a.horario}`).join('\n') +
          '\nSe quiser ver mais opções, é só pedir!';
        break;
      }

      case 'confirmar_escolha_os': {
        if (!user.clienteId) {
          resposta = await gerarMensagemDaIntent({
            intent,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'Peça o CPF primeiro.'
          });
          break;
        }

        if (user.osEscolhida) {
          // já temos
        } else if (user.osProposta) {
          user.osEscolhida = user.osProposta;
        } else {
          const posicao = await interpretarEscolhaOS({
            mensagem,
            osList: user.osList,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'tente identificar a escolha da OS.'
          });
          if (posicao && user.osList[posicao - 1]) {
            user.osEscolhida = user.osList[posicao - 1];
          }
        }

        if (!user.osEscolhida) {
          resposta = 'Desculpe, não identifiquei a OS. Por favor, digite o número dela ou diga “primeira/segunda…”.';
          break;
        }

        const sugestoes = await gerarSugestoesDeAgendamento(user.osEscolhida);
        user.sugestaoData = sugestoes.sugestao.data;
        user.sugestaoHora = sugestoes.sugestao.horario;

        resposta =
          `Perfeito! Vamos agendar a OS ${user.osEscolhida.id}. ` +
          `Sugiro ${dayjs(sugestoes.sugestao.data).format('DD/MM/YYYY')} às ${sugestoes.sugestao.horario}. Serve pra você?`;
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
        if (!user.osEscolhida) {
          const posicao = await interpretarEscolhaOS({
            mensagem,
            osList: user.osList,
            agentId: 'default-agent',
            dados: contexto,
            promptExtra: 'tente identificar a escolha da OS.'
          });
          if (posicao && user.osList[posicao - 1]) {
            user.osEscolhida = user.osList[posicao - 1];
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

        if (!user.dataInterpretada || !user.periodoAgendamento) {
          // Se não tem data/hora ainda, pede de novo
          resposta = 'Preciso que você me informe a data e o período para agendarmos.';
          break;
        }

        // Se passou aqui, temos tudo: OS + data + hora
        const payload = {
          ...user.osEscolhida,
          data_agenda_final: `${user.dataInterpretada} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}` ,
          melhor_horario_agenda: 'M'
        };

        const resultado = await atualizarOS(user.osEscolhida.id, payload);
        console.log('resultado: ' + JSON.stringify(resultado));
        if (resultado?.mensagem) {
          resposta = resultado.mensagem;
        } else if (user.osEscolhida && user.dataInterpretada && user.periodoAgendamento) {
          const assunto = user.osEscolhida.titulo || user.osEscolhida.mensagem || `OS ${user.osEscolhida.id}`;
          const dataFormatada = dayjs(user.dataInterpretada).format('DD/MM/YYYY');
          const diaSemana = diaDaSemanaExtenso(user.dataInterpretada);
          resposta = `Prontinho! Sua visita para ${assunto} está agendada! Ficou para ${diaSemana}, dia ${dataFormatada} no período da ${user.periodoAgendamento === 'M' ? 'manhã' : 'tarde'}.
          Estou finalizando nosso atendimento. Caso precise de mim, estou por aqui.`;
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
          const dataFormatada = os.data_agenda_final && os.data_agenda_final !== '0000-00-00 00:00:00' ? dayjs(os.data_agenda_final).format('DD/MM/YYYY [às] HH:mm') : null;
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
    await enviarMensagemWhatsApp(numero, resposta);

    /* -------------------- 8. Salva Mongo se habilitado ------------- */
    if (boolSalvarConversa) {
      try {
        const { salvarConversa } = require('../services/conversaService');
        await salvarConversa({
          numero,
          mensagem_usuario: mensagem,
          mensagem_sistema: resposta,
          intent,
          etapa: user.etapaAtual,
          dados_extras: {
            cpf: user.cpf,
            clienteId: user.clienteId,
            osEscolhida: user.osEscolhida,
            nomeCliente: user.nomeCliente
          }
        });
      } catch (e) {
        console.error('Falha ao salvar conversa:', e);
      }
    }

    /* -------------------- 9. Resposta HTTP ------------------------- */
    return res.json({ para: numero, status: 'OK', mensagem: resposta, intent });

  } catch (err) {
    console.error('Erro webhook:', err);
    const erroMsg = '❌ Ocorreu um erro interno. Tente novamente mais tarde.';
    await enviarMensagemWhatsApp(numero, erroMsg);
    return res.json({ para: numero, status: 'erro', mensagem: erroMsg });
  }
});

module.exports = router;
