const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
// Importar e registrar o plugin isBetween para dayjs
const isBetweenPlugin = require('dayjs/plugin/isBetween');
dayjs.extend(isBetweenPlugin);
const { isDiaUtil, getProximoDiaUtil, getFeriadosNacionais } = require('./ixcUtilsData');
const configuracoesAgendamento = require('./configuracoes_agendamentos');
//const { getConfig } = require('../config/config');
require('dotenv').config(); // carrega as variáveis do .env

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const api = axios.create({
  baseURL: 'https://demo.ixcsoft.com.br/webservice/v1',
  auth: {
    username: process.env.API_USER,
    password: process.env.API_PASS
  },
  httpsAgent,
  headers: {
    'Content-Type': 'application/json',
    ixcsoft: 'listar'
  }
});

async function buscarOS(osId) {
  const body = {
    qtype: 'su_oss_chamado.id',
    query: osId,
    oper: '=',
    page: '1',
    rp: '1',
    sortname: 'su_oss_chamado.id',
    sortorder: 'asc'
  };

  const response = await api.post('/su_oss_chamado', body);
  return response.data.registros;
}

async function buscarOSPorClienteId(clienteId) {
  console.error('buscarOSPorClienteId:', clienteId);

  const body = new URLSearchParams();
  body.append('qtype', 'su_oss_chamado.id_cliente');
  body.append('query', clienteId);
  body.append('oper', '=');
  body.append('page', '1');
  body.append('rp', '50');
  body.append('sortname', 'su_oss_chamado.id');
  body.append('sortorder', 'desc');

  try {
    const response = await api.post('/su_oss_chamado', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ixcsoft: 'listar' }
    });

    const registros = response.data?.registros || [];
    console.log('📦 OS encontradas por clienteId:', registros);
    return registros;
  } catch (error) {
    console.error('❌ Erro ao buscar OS por clienteId:', error);
    return [];
  }
}

async function atualizarOS(osId, payloadOriginal) {
  const payload = { ...payloadOriginal };
  
  // TEMPORÁRIO: Definir ID do técnico como 2 para testes
  payload.id_tecnico = 2;

  const limparCampos = [
    'data_hora_analise', 'data_hora_encaminhado', 'data_hora_assumido', 'data_hora_execucao',
    'data_agenda_final', 'status_sla', 'melhor_horario_agenda', 'origem_os_aberta', 'protocolo',
    'complemento', 'bloco', 'latitude', 'apartamento', 'longitude', 'bairro', 'referencia',
    'impresso', 'data_prazo_limite', 'data_reservada', 'justificativa_sla_atrasado',
    'origem_endereco_estrutura', 'data_reagendar', 'data_prev_final', 'origem_cadastro'
  ];
  // Removido 'data_final' da lista de campos a serem limpos para garantir que ele seja enviado corretamente

  limparCampos.forEach((campo) => {
    if (
      payload[campo] === '0000-00-00 00:00:00' ||
      payload[campo] === '0000-00-00' ||
      payload[campo] === undefined
    ) {
      payload[campo] = '';
    }
  });
  
  // Garantir que os campos de data estejam corretamente definidos
  if (payload.data_agenda_final && payload.data_agenda_final !== '0000-00-00 00:00:00' && payload.data_agenda_final !== '') {
    // Armazenar a data original de agendamento
    const dataOriginal = payload.data_agenda_final;
    const dataAgendaObj = dayjs(dataOriginal);
    
    // Definir data_inicio como a data e hora original do agendamento
    payload.data_inicio = dataAgendaObj.format('YYYY-MM-DD HH:mm:ss');
    console.log(`Definindo data_inicio: ${payload.data_inicio}`);
    
    // Definir data_agenda_final como 4 horas depois da data_inicio (requisito do sistema)
    payload.data_agenda_final = dataAgendaObj.add(4, 'hour').format('YYYY-MM-DD HH:mm:ss');
    console.log(`Ajustando data_agenda_final: ${payload.data_agenda_final} (4h após data_inicio)`);
    
    // Definir data_final igual a data_agenda_final para garantir consistência
    payload.data_final = payload.data_agenda_final;
    console.log(`Definindo data_final: ${payload.data_final}`);
  }

  // const removerCampos = ['idx', 'preview', 'id_tecnico', 'id', 'id_condominio'];
  const removerCampos = ['idx', 'preview', 'id', 'id_condominio'];
  removerCampos.forEach((campo) => delete payload[campo]);

  payload.status = 'AG';

  console.log('📦 Payload enviado para o IXC (atualizarOS):');
  console.dir(payload, { depth: null });

  const response = await api.put(`/su_oss_chamado/${osId}`, payload, {
    headers: { ixcsoft: '' }
  });

  if (response.data?.type === 'error') {
    return {
      mensagem: `❌ Falha ao atualizar OS ${osId}: ${response.data.message || 'Erro desconhecido'}`,
      detalhes: response.data
    };
  }

  // Buscar assunto/título da OS
  const assunto = payload.titulo || payload.mensagem || payload.motivo || 'a visita';
  
  // Buscar data e período agendados
  let dataFormatada = '';
  let periodoTexto = '';
  let diaSemana = '';
  
  if (payload.data_agenda_final) {
    const [data] = payload.data_agenda_final.split(' ');
    if (data) {
      const dataObj = dayjs(data);
      dataFormatada = dataObj.format('DD/MM/YYYY');
      
      // Obter dia da semana
      const { diaDaSemanaExtenso } = require('../app/utils/dateHelpers');
      diaSemana = diaDaSemanaExtenso(data);
      // Capitalizar primeira letra
      diaSemana = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
      
      // Verificar período (manhã/tarde)
      if (payload.melhor_horario_agenda) {
        periodoTexto = payload.melhor_horario_agenda === 'M' ? 'manhã' : 'tarde';
      }
    }
  }
  
  // Construir mensagem amigável e detalhada
  let mensagem;
  if (dataFormatada) {
    if (periodoTexto) {
      mensagem = `Prontinho! Sua visita para ${assunto} está agendada! ` +
                `Ficou para ${diaSemana}, dia ${dataFormatada}, no período da ${periodoTexto}. ` +
                `Estou finalizando nosso atendimento. Caso precise de mim, estou por aqui.`;
    } else {
      mensagem = `Prontinho! Sua visita para ${assunto} está agendada! ` +
                `Ficou para ${diaSemana}, dia ${dataFormatada}. ` +
                `Estou finalizando nosso atendimento. Caso precise de mim, estou por aqui.`;
    }
  } else {
    mensagem = `Prontinho! Sua OS ${osId} foi atualizada com sucesso. Caso precise de mim, estou por aqui.`;
  }
  return {
    mensagem,
    data: response.data
  };
}

async function buscarColaboradorPorCpf(cpf) {
  console.log(`🔍 Buscando colaborador por CPF: ${cpf}`);

  const body = new URLSearchParams();
  body.append('qtype', 'funcionarios.cpf_cnpj');
  body.append('query', cpf);
  body.append('oper', '=');
  body.append('page', '1');
  body.append('rp', '20');
  body.append('sortname', 'funcionarios.id');
  body.append('sortorder', 'asc');

  try {
    const response = await api.post('/funcionarios', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ixcsoft: 'listar' }
    });

    const registros = response.data?.registros;

    if (!registros || registros.length === 0) {
      console.log('⚠️ Nenhum registro encontrado.');
      return { mensagem: `❌ Colaborador com CPF ${cpf} não encontrado.`, data: null };
    }

    const colaborador = registros[0];
    console.log('✅ Colaborador encontrado:', colaborador);

    return { mensagem: `✅ Colaborador encontrado com CPF ${cpf}`, data: colaborador };
  } catch (error) {
    console.error('🚨 Erro na API:', error);
    return { mensagem: `❌ Erro ao buscar colaborador: ${error.message}`, data: null };
  }
}

function formatarCpf(cpf) {
  const apenasNumeros = cpf.replace(/\D/g, '');
  return apenasNumeros.length === 11
    ? apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    : cpf;
}

async function buscarClientePorCpf(cpf) {
  const cpfFormatado = formatarCpf(cpf);

  const body = new URLSearchParams();
  body.append('qtype', 'cliente.cnpj_cpf');
  body.append('query', cpfFormatado);
  body.append('oper', '=');
  body.append('page', '1');
  body.append('rp', '10000');
  body.append('sortname', 'cliente.id');
  body.append('sortorder', 'asc');

  try {
    const response = await api.post('/cliente', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ixcsoft: 'listar' }
    });

    const registros = response.data?.registros;
    if (!registros || Object.keys(registros).length === 0) {
      return { mensagem: `❌ Cliente com CPF ${cpfFormatado} não encontrado.` };
    }

    const cliente = Object.values(registros).find(c => (c.cnpj_cpf || '').trim() === cpfFormatado);

    if (!cliente) {
      return { mensagem: `❌ Cliente com CPF ${cpfFormatado} não encontrado com correspondência exata.` };
    }

    return { mensagem: '✅ Cliente encontrado', cliente };
  } catch (error) {
    console.error('❌ Erro ao buscar cliente:', error.message);
    return { mensagem: `❌ Erro ao buscar cliente: ${error.message}` };
  }
}

/**
 * Gera sugestões de agendamento para uma OS
 * @param {Object} os - Objeto da OS
 * @param {number} prioridade - Prioridade do agendamento (0: mais rápido, 1: metade do período, 2: último dia)
 * @param {string} dataMinima - Data mínima para agendamento (formato YYYY-MM-DD, opcional)
 * @param {string} dataMaxima - Data máxima para agendamento (formato YYYY-MM-DD, opcional)
 * @returns {Promise<Object>} Objeto com sugestão principal e alternativas
 */
async function gerarSugestoesDeAgendamento(os, opcoes = {}) {
  const { dataEspecifica, periodoEspecifico } = opcoes;
  console.log('====[ gerarSugestoesDeAgendamento ]====');
  console.log('[LOG] Opções recebidas:', opcoes);
  console.log('[LOG] Objeto OS recebido:', JSON.stringify(os, null, 2));
  // Removed log referencing prioridade before it's defined

  // Encontrar configuração para o assunto da OS
  const idAssunto = os.id_assunto;
  const config = configuracoesAgendamento.find(c => c.id_assunto == idAssunto);

  if (!config) {
    console.error(`[ERRO] Configuração de agendamento não encontrada para o assunto ID: ${idAssunto}`);
    // Retorna vazio se não encontrar config, impedindo agendamento.
    return { sugestao: null, alternativas: [] };
  }

  // Extrair dados da configuração encontrada
  const prioridade = config.prioridade;
  const diasMin = config.dataMinimaAgendamentoDias;
  const diasMax = config.prazoMaximoAgendamentoDias;

  console.log('[LOG] prioridade:', prioridade);
  console.log('[LOG] diasMin:', diasMin);
  console.log('[LOG] diasMax:', diasMax);
 
  // Calcular data mínima
  let dataMinimaObj;
  
  // Se foi especificada uma data, usar essa data como mínima
  if (dataEspecifica && dayjs(dataEspecifica).isValid()) {
    dataMinimaObj = dayjs(dataEspecifica);
    console.log(`[INFO] Usando data específica como mínima: ${dataMinimaObj.format('DD/MM/YYYY')}`);
  } else {
    dataMinimaObj = dayjs(); // Começa de hoje
    if (diasMin > 0) {
        dataMinimaObj = dataMinimaObj.add(diasMin, 'day');
    }
    // Garante que a data mínima seja um dia útil
    while (!isDiaUtil(dataMinimaObj)) {
        dataMinimaObj = dataMinimaObj.add(1, 'day');
    }
  }

  // Calcular data máxima
  let dataMaximaObj;
  
  // Se foi especificada uma data, usar essa data como máxima também
  if (dataEspecifica && dayjs(dataEspecifica).isValid()) {
    dataMaximaObj = dayjs(dataEspecifica);
    console.log(`[INFO] Usando data específica como máxima: ${dataMaximaObj.format('DD/MM/YYYY')}`);
  } else {
    let dataBaseParaMaxima = os.data_abertura ? dayjs(os.data_abertura) : dayjs();
    dataMaximaObj = dataBaseParaMaxima; // Começa da data base
    let diasUteisContados = 0;

    // Adiciona 'diasMax' dias úteis à data base
    while (diasUteisContados < diasMax) {
        dataMaximaObj = dataMaximaObj.add(1, 'day');
        if (isDiaUtil(dataMaximaObj)) {
            diasUteisContados++;
        }
    }
  }

  // Garante que a data máxima seja pelo menos um dia útil após a data mínima
  let dataMinimaMaisUmDiaUtil = getProximoDiaUtil(dataMinimaObj);
  if (dataMaximaObj.isBefore(dataMinimaMaisUmDiaUtil)) {
      dataMaximaObj = dataMinimaMaisUmDiaUtil;
      console.log(`[INFO] Data máxima ajustada para ${dataMaximaObj.format('DD/MM/YYYY')} para garantir intervalo mínimo.`);
  }

  console.log(`OS ID: ${os.id}, Assunto: ${idAssunto}, Setor: ${os.setor}`);
  console.log(`Config encontrada: Prioridade=${prioridade}, MinDias=${diasMin}, MaxDias=${diasMax}`);
  console.log(`[LOG] Datas para análise: mínima=${dataMinimaObj.format('YYYY-MM-DD')}, máxima=${dataMaximaObj.format('YYYY-MM-DD')}`);
  console.log(`Data mínima calculada: ${dataMinimaObj.format('DD/MM/YYYY')}`);
  console.log(`Data máxima calculada: ${dataMaximaObj.format('DD/MM/YYYY')}`);

  const periodos = ['M', 'T']; // M = manhã, T = tarde
  const vinculos = require('./ixcConfigAgendamento').vinculosTecnicoSetor; // Carregar vínculos aqui (já é o resultado da função)
  
  // Carregar vínculos de técnicos com setores
  // const vinculos = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/vinculos_tecnicos_setores.json'), 'utf8'));

  // Corrigir campo de setor
  const setor = String(os.id_setor || os.setor_id || os.setor);
  try {
    // 1. Buscar OS agendadas do mesmo setor, status 'AG', dentro do período definido
    const body = new URLSearchParams();
    body.append('qtype', 'su_oss_chamado.status');
    body.append('query', 'AG');
    body.append('oper', '=');
    body.append('page', '1');
    body.append('rp', '1000');
    body.append('sortname', 'su_oss_chamado.id');
    body.append('sortorder', 'desc');

    const response = await api.post('/su_oss_chamado', body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ixcsoft: 'listar'
      }
    });

    const osAgendadas = response.data.registros.filter(o => 
      o.status === 'AG' && 
      o.data_agenda_final && 
      dayjs(o.data_agenda_final).isBetween(dataMinimaObj, dataMaximaObj, null, '[]')
      //  &&
      // o.id_tecnico
    );
    console.log('[1] Total de OS agendadas consideradas:', osAgendadas.length);
    osAgendadas.forEach(o => {
      console.log(`[1.1] OS ${o.id} - Técnico: ${o.id_tecnico}, Data: ${o.data_agenda_final}, Período: ${o.melhor_horario_agenda}`);
    });

    // 3. Montar períodos ocupados por técnico e data
    const ocupadosPorTecnico = {};
    for (const o of osAgendadas) {
      const idTec = o.id_tecnico;
      const data = dayjs(o.data_agenda_final).format('YYYY-MM-DD');
      const hora = dayjs(o.data_agenda_final).format('HH:mm:ss');
      const periodo = o.melhor_horario_agenda || (parseInt(hora) < 12 ? 'M' : 'T'); // Usa 'M' ou 'T' baseado na hora
      
      if (!ocupadosPorTecnico[idTec]) ocupadosPorTecnico[idTec] = {};
      if (!ocupadosPorTecnico[idTec][data]) ocupadosPorTecnico[idTec][data] = { M: 0, T: 0 };
      ocupadosPorTecnico[idTec][data][periodo]++;
    }
    
    console.log('[3] Mapeamento de ocupação por técnico concluído');
    Object.entries(ocupadosPorTecnico).forEach(([tec, datas]) => {
      Object.entries(datas).forEach(([data, periodos]) => {
        console.log(`[3.1] Técnico ${tec} - ${data}: manhã=${periodos.M}, tarde=${periodos.T}`);
      });
    });

    // 4. Buscar todos os técnicos ativos (id_funcao=2) na API e filtrar pelo vínculo com o setor da OS
    const bodyTec = new URLSearchParams();
    console.log('[4] Buscando técnicos ativos (id_funcao=2) na API...');
    bodyTec.append('qtype', 'funcionarios.id'); // buscar todos
    bodyTec.append('query', '0');
    bodyTec.append('oper', '!=');
    bodyTec.append('page', '1');
    bodyTec.append('rp', '1000');
    bodyTec.append('sortname', 'funcionarios.id');
    bodyTec.append('sortorder', 'asc');
    bodyTec.append('filter', JSON.stringify({ ativo: 'S', id_funcao: '2' }));
    let tecnicosSetor = [];
    try {
      const respTec = await api.post('/funcionarios', bodyTec, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ixcsoft: 'listar' }
      });
      const tecnicosApi = Object.values(respTec.data?.registros || {});
      //console.log('[4.1] Técnicos ativos retornados pela API:', tecnicosApi.map(t => ({id: t.id, nome: t.nome, setores: vinculos[t.id]})));
      tecnicosSetor = tecnicosApi
        .filter(tec => Array.isArray(vinculos[tec.id]) && vinculos[tec.id].includes(setor))
        .map(tec => tec.id);
      //console.log('[4.2] Técnicos ativos e vinculados ao setor:', tecnicosSetor);
    } catch (e) {
      console.error('Erro ao buscar técnicos ativos:', e.message);
    }

    // 5. Gerar períodos disponíveis por técnico
    const alternativas = [];
    const limiteAgendamentos = { M: 2, T: 3 }; // 2 pela manhã, 3 à tarde
    
    for (const idTec of tecnicosSetor) {
      console.log(`[5] Gerando períodos disponíveis para técnico ${idTec}`);
      
      // Percorrer todas as datas dentro do período definido
      let dia = dataMinimaObj.clone();
      const datasDisponiveis = [];
      
      while (dia.isBefore(dataMaximaObj, 'day') || dia.isSame(dataMaximaObj, 'day')) {
        // Verificar se é dia útil (não é final de semana nem feriado)
        if (isDiaUtil(dia)) {
          const dataStr = dia.format('YYYY-MM-DD');
          const ocupados = ocupadosPorTecnico[idTec]?.[dataStr] || { M: 0, T: 0 };
          const periodosDisponiveis = [];
          // Só há dois períodos possíveis: manhã (M) e tarde (T)
          for (const periodo of ['M', 'T']) {
            if (ocupados[periodo] < limiteAgendamentos[periodo]) {
              periodosDisponiveis.push(periodo);
            }
          }
          if (periodosDisponiveis.length > 0) {
            console.log(`[5.1] Técnico ${idTec} - Data ${dataStr} disponível nos períodos: ${periodosDisponiveis.join(', ')}`);
            datasDisponiveis.push({ data: dataStr, periodos: periodosDisponiveis });
          }
        }
        dia = dia.add(1, 'day');
      }
      if (datasDisponiveis.length > 0) {
        alternativas.push({ id_tecnico: idTec, datasDisponiveis });
      }
    }

    // 6. Aplicar lógica de prioridade para escolher a melhor data
    let sugestao = null;
    
    if (alternativas.length > 0) {
      // Ordenar alternativas por data (mais próxima primeiro)
      alternativas.sort((a, b) => {
        const dataA = dayjs(a.datasDisponiveis[0].data);
        const dataB = dayjs(b.datasDisponiveis[0].data);
        return dataA.diff(dataB);
      });
      
      // Priorizar período específico (se fornecido) ou o período preferido da OS
      const periodoPreferido = periodoEspecifico || os.melhor_horario_agenda || 'M';
      console.log(`[INFO] Período preferido: ${periodoPreferido}`);
      
      // Filtrar alternativas que incluem o período preferido
      const alternativasPreferidas = alternativas.filter(a => a.datasDisponiveis[0].periodos.includes(periodoPreferido));
      const listaFinal = alternativasPreferidas.length > 0 ? alternativasPreferidas : alternativas;
      
      // Aplicar lógica de prioridade
      if (prioridade === 0) {
        // Prioridade 0: mais rápido possível
        sugestao = listaFinal[0];
      } else if (prioridade === 1) {
        // Prioridade 1: meio do período
        const meio = Math.floor(listaFinal.length / 2);
        sugestao = listaFinal[meio];
      } else if (prioridade === 2) {
        // Prioridade 2: último dia do período
        sugestao = listaFinal[listaFinal.length - 1];
      } else {
        // Padrão: mais rápido possível
        sugestao = listaFinal[0];
      }
    }

    // Formatar a sugestão principal
    let sugestaoFormatada = null;
    if (sugestao) {
      const dataDisponivel = sugestao.datasDisponiveis[0];
      const periodoPreferido = periodoEspecifico || os.melhor_horario_agenda || 'M';
      const periodo = dataDisponivel.periodos.includes(periodoPreferido) ? periodoPreferido : dataDisponivel.periodos[0];
      
      sugestaoFormatada = {
        id_tecnico: sugestao.id_tecnico,
        data: dataDisponivel.data,
        periodo: periodo
      };
    }
    
    // Formatar alternativas
    const alternativasFormatadas = [];
    for (const alt of alternativas) {
      for (const dataDisp of alt.datasDisponiveis) {
        for (const periodo of dataDisp.periodos) {
          alternativasFormatadas.push({
            id_tecnico: alt.id_tecnico,
            data: dataDisp.data,
            periodo: periodo
          });
        }
      }
    }
    
    // Ordenar alternativas por data
    alternativasFormatadas.sort((a, b) => {
      const dataA = dayjs(a.data);
      const dataB = dayjs(b.data);
      return dataA.diff(dataB);
    });
    
    // Remover duplicidade da sugestão principal nas alternativas
    const alternativasFiltradas = alternativasFormatadas.filter(alt => {
      if (!sugestaoFormatada) return true;
      return !(alt.id_tecnico === sugestaoFormatada.id_tecnico && alt.data === sugestaoFormatada.data && alt.periodo === sugestaoFormatada.periodo);
    });

    console.log('[7] Total de alternativas geradas:', alternativasFiltradas.length);
    if (sugestaoFormatada) {
      console.log('[8] Sugestão principal:', sugestaoFormatada);
    } else {
      console.log('[8] Não foi possível gerar uma sugestão principal');
    }

    return {
      sugestao: sugestaoFormatada,
      alternativas: alternativasFiltradas
    };
  } catch (error) {
    console.error('Erro ao gerar sugestões de agendamento:', error);
    return {
      sugestao: null,
      alternativas: []
    };
  }
}

/**
 * Verifica a disponibilidade de uma data para agendamento
 * @param {Object} os - Objeto da OS
 * @param {string} dataDesejada - Data desejada no formato YYYY-MM-DD
 * @param {string} periodoDesejado - Período desejado (M ou T)
 * @param {string} dataMinima - Data mínima para agendamento (formato YYYY-MM-DD, opcional)
 * @param {number} prazoMaximoDias - Prazo máximo em dias úteis para agendamento (opcional)
 * @param {string} dataMaxima - Data máxima para agendamento (formato YYYY-MM-DD, opcional)
 * @returns {Promise<Object>} Resultado da verificação
 */
async function verificarDisponibilidadeData(os, dataDesejada, periodoDesejado, dataMinima = null, prazoMaximoDias = null, dataMaxima = null) {
  console.log('====[ verificarDisponibilidadeData ]====');
  console.log(`[LOG] OS recebida:`, JSON.stringify(os, null, 2));
  console.log(`[LOG] Data desejada: ${dataDesejada}, Período desejado: ${periodoDesejado}`);
  if (dataMinima) console.log(`[LOG] Data mínima recebida: ${dataMinima}`);
  if (dataMaxima) console.log(`[LOG] Data máxima recebida: ${dataMaxima}`);
  if (prazoMaximoDias) console.log(`[LOG] Prazo máximo dias recebido: ${prazoMaximoDias}`);
  console.log(`Verificando disponibilidade para ${dataDesejada} - Período: ${periodoDesejado}`);
  
  // Verificar se a data é válida
  const dataObj = dayjs(dataDesejada);
  if (!dataObj.isValid()) {
    return {
      disponivel: false,
      mensagem: `Data ${dataDesejada} inválida.`,
      dataDesejada,
      periodoDesejado,
      alternativas: []
    };
  }
  
  // Verificar se é dia útil
  if (!isDiaUtil(dataObj)) {
    return {
      disponivel: false,
      mensagem: `Data ${dataDesejada} não é um dia útil (final de semana ou feriado).`,
      dataDesejada,
      periodoDesejado,
      alternativas: []
    };
  }
  
  // Obter configurações de agendamento baseadas no assunto da OS
  const configOS = configuracoesAgendamento.find(c => c.id_assunto == os.id_assunto);

  // Sempre usar as configurações vindas do arquivo, nunca parâmetros externos
  prazoMaximoDias = prazoMaximoDias !== null ? prazoMaximoDias : configOS.prazoMaximoAgendamentoDias;
  
  // Definir data mínima e máxima para agendamento
  const dataMinimaObj = dataMinima ? dayjs(dataMinima) : dayjs(); // Começa de hoje
  const dataAberturaOS = os.data_abertura ? dayjs(os.data_abertura) : dayjs();
  const dataMaximaObj = dataMaxima ? dayjs(dataMaxima) : dataAberturaOS; // Começa da data base
  let diasUteisContados = 0;

  // Adiciona 'diasMax' dias úteis à data base
  while (diasUteisContados < prazoMaximoDias) {
      dataMaximaObj = dataMaximaObj.add(1, 'day');
      if (isDiaUtil(dataMaximaObj)) {
          diasUteisContados++;
      }
  }

  // Verificar se a data está dentro do período permitido
  if (dataObj.isBefore(dataMinimaObj, 'day')) {
    return {
      disponivel: false,
      mensagem: `Data ${dataDesejada} está antes da data mínima permitida (${dataMinimaObj.format('DD/MM/YYYY')}).`,
      dataDesejada,
      periodoDesejado,
      alternativas: []
    };
  }
  
  if (dataObj.isAfter(dataMaximaObj, 'day')) {
    return {
      disponivel: false,
      mensagem: `Data ${dataDesejada} está após o prazo máximo de ${prazoMaximoDias} dias úteis (${dataMaximaObj.format('DD/MM/YYYY')}).`,
      dataDesejada,
      periodoDesejado,
      alternativas: []
    };
  }
  
  // Obter sugestões de agendamento usando a nova abordagem
  const sugestoes = await gerarSugestoesDeAgendamento(os);
  console.log('[LOG] Sugestões retornadas:', JSON.stringify(sugestoes, null, 2));
  if (!sugestoes || !sugestoes.alternativas || sugestoes.alternativas.length === 0) {
    return {
      disponivel: false,
      mensagem: "Não há horários disponíveis para agendamento.",
      dataDesejada,
      periodoDesejado,
      alternativas: []
    };
  }
  
  // Verificar se a data/período desejado está disponível
  const dataDesejadaDisponivel = sugestoes.alternativas.find(
    alt => alt.data === dataDesejada && alt.periodo === periodoDesejado
  );
  if (dataDesejadaDisponivel) {
    console.log(`[LOG] Data/período disponível encontrada para técnico ${dataDesejadaDisponivel.id_tecnico}`);
  } else {
    console.log('[LOG] Data/período desejado não disponível. Buscando alternativas próximas...');
  }
  
  // Se a data desejada estiver disponível
  if (dataDesejadaDisponivel) {
    return {
      disponivel: true,
      mensagem: `Data ${dataDesejada} - ${periodoDesejado === 'M' ? 'Manhã' : 'Tarde'} disponível para agendamento.`,
      dataDesejada,
      periodoDesejado,
      tecnico: dataDesejadaDisponivel.id_tecnico,
      alternativas: obterAlternativasProximas(dataDesejada, sugestoes.alternativas)
    };
  }
  
  // Se a data desejada não estiver disponível, buscar alternativas
  const alternativas = obterAlternativasProximas(dataDesejada, sugestoes.alternativas);
  
  return {
    disponivel: false,
    mensagem: `Data ${dataDesejada} - ${periodoDesejado === 'M' ? 'Manhã' : 'Tarde'} não disponível para agendamento.`,
    dataDesejada,
    periodoDesejado,
    alternativas
  };
}

/**
 * Função auxiliar para obter alternativas próximas a uma data
 * @param {string} dataReferencia - Data de referência no formato YYYY-MM-DD
 * @param {Array} alternativas - Lista de alternativas disponíveis
 * @returns {Array} Lista com até 3 alternativas próximas
 */
function obterAlternativasProximas(dataReferencia, alternativas) {
  // Converter a data de referência para um objeto dayjs
  const dataRef = dayjs(dataReferencia);
  
  // Calcular a diferença em dias para cada alternativa
  const comDistancia = alternativas.map(alt => ({
    ...alt,
    distancia: Math.abs(dayjs(alt.data).diff(dataRef, 'day'))
  }));
  
  // Ordenar por proximidade da data de referência
  comDistancia.sort((a, b) => a.distancia - b.distancia);
  
  // Filtrar para ter datas distintas (pegar a primeira ocorrência de cada data)
  const datasUnicas = new Set();
  const alternativasUnicas = comDistancia.filter(alt => {
    if (!datasUnicas.has(alt.data)) {
      datasUnicas.add(alt.data);
      return true;
    }
    return false;
  });
  
  // Retornar as 3 primeiras alternativas
  return alternativasUnicas.slice(0, 3).map(alt => ({
    data: alt.data,
    periodo: alt.periodo,
    tecnico: alt.id_tecnico,
    distancia: alt.distancia
  }));
}

module.exports = {
  buscarOS,
  buscarOSPorClienteId,
  atualizarOS,
  buscarColaboradorPorCpf,
  buscarClientePorCpf,
  gerarSugestoesDeAgendamento,
  verificarDisponibilidadeData,
  obterAlternativasProximas
};