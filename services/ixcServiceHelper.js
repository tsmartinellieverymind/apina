/**
 * Helper para funções de agendamento no ixcService usando nova estrutura de vínculos
 * onde setores têm técnicos, não técnicos têm setores
 */

const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { isDiaUtil } = require('./ixcUtilsData');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

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

/**
 * Obtém os técnicos vinculados a um setor
 * @param {string} idSetor - ID do setor
 * @returns {string[]} Lista de IDs dos técnicos vinculados ao setor
 */
function getTecnicosPorSetor(idSetor) {
  try {
    const vinculosPath = path.join(__dirname, '../app/data/vinculos_setores_tecnicos.json');
    const vinculos = JSON.parse(fs.readFileSync(vinculosPath, 'utf8'));
    return vinculos[idSetor] || [];
  } catch (error) {
    console.error('Erro ao obter técnicos por setor:', error.message);
    return [];
  }
}

/**
 * Filtra técnicos ativos que estão vinculados ao setor especificado
 * @param {Array} tecnicosApi - Lista de técnicos retornados pela API
 * @param {string} idSetor - ID do setor
 * @returns {string[]} Lista de IDs dos técnicos ativos vinculados ao setor
 */
function filtrarTecnicosPorSetor(tecnicosApi, idSetor) {
  const tecnicosDoSetor = getTecnicosPorSetor(idSetor);
  console.log(`Técnicos vinculados ao setor ${idSetor}:`, tecnicosDoSetor);
  
  const tecnicosAtivosDoSetor = tecnicosApi
    .filter(tec => tecnicosDoSetor.includes(tec.id))
    .map(tec => tec.id);
    
  console.log('Técnicos ativos do setor:', tecnicosAtivosDoSetor);
  return tecnicosAtivosDoSetor;
}

/**
 * Versão atualizada do gerarSugestoesDeAgendamento usando a nova estrutura de vínculos
 */
async function gerarSugestoesDeAgendamentoV2(os, opcoes = {}) {
  const { dataEspecifica, periodoEspecifico } = opcoes;
  console.log('====[ gerarSugestoesDeAgendamentoV2 - Nova estrutura ]====');
  console.log('[LOG] Opções recebidas:', opcoes);
  console.log('[LOG] Objeto OS recebido:', JSON.stringify(os, null, 2));
  
  // Importar configurações de agendamento
  const configuracoesAgendamento = require('../app/data/configuracoes_agendamentos.js');
  const periodos = ['M', 'T']; // M = manhã, T = tarde

  // Encontrar configuração para o assunto da OS
  const idAssunto = os.id_assunto;
  const config = configuracoesAgendamento.find(c => c.id_assunto == idAssunto);

  if (!config) {
    console.error(`[ERRO] Configuração de agendamento não encontrada para o assunto ID: ${idAssunto}`);
    return { sugestao: null, alternativas: [] };
  }

  // Extrair dados da configuração encontrada
  const prioridade = config.prioridade;
  const diasMin = config.dataMinimaAgendamentoDias;
  const diasMax = config.dataMaximaAgendamentoDias;

  // Calcular data mínima
  let dataMinimaObj;
  
  // Se foi especificada uma data, usar essa data como mínima
  if (dataEspecifica && dayjs(dataEspecifica).isValid()) {
    dataMinimaObj = dayjs(dataEspecifica);
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

  // Extrair o setor da OS
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
    );
    console.log('[1] Total de OS agendadas consideradas:', osAgendadas.length);
    
    // 2. Montar períodos ocupados por técnico e data
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
    
    // 3. Buscar todos os técnicos ativos (id_funcao=2) na API
    const bodyTec = new URLSearchParams();
    console.log('[3] Buscando técnicos ativos (id_funcao=2) na API...');
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
      
      // 4. NOVA LÓGICA: Filtrar técnicos que pertencem ao setor usando a nova estrutura
      tecnicosSetor = filtrarTecnicosPorSetor(tecnicosApi, setor);
      console.log('[4] Técnicos ativos e vinculados ao setor:', tecnicosSetor);
    } catch (e) {
      console.error('Erro ao buscar técnicos ativos:', e.message);
    }

    // 5. Gerar períodos disponíveis por técnico
    const alternativas = [];
    const limiteAgendamentos = { M: 2, T: 3 }; // 2 pela manhã, 3 à tarde
    
    for (const idTec of tecnicosSetor) {
      // Percorrer todas as datas dentro do período definido
      let dia = dataMinimaObj.clone();
      const datasDisponiveis = [];
      
      while (dia.isBefore(dataMaximaObj, 'day') || dia.isSame(dataMaximaObj, 'day')) {
        if (isDiaUtil(dia)) {
          const dataStr = dia.format('YYYY-MM-DD');
          const ocupados = ocupadosPorTecnico[idTec]?.[dataStr] || { M: 0, T: 0 };
          const periodosDisponiveis = [];
          
          for (const periodo of periodos) {
            if (ocupados[periodo] < limiteAgendamentos[periodo]) {
              periodosDisponiveis.push(periodo);
            }
          }
          
          if (periodosDisponiveis.length > 0) {
            datasDisponiveis.push({ data: dataStr, periodos: periodosDisponiveis });
          }
        }
        dia = dia.add(1, 'day');
      }
      
      if (datasDisponiveis.length > 0) {
        // Filtrar opções específicas de data/período se solicitado
        if (dataEspecifica || periodoEspecifico) {
          const dataFiltro = dataEspecifica ? dayjs(dataEspecifica).format('YYYY-MM-DD') : null;
          for (const disp of datasDisponiveis) {
            if ((!dataFiltro || disp.data === dataFiltro) && 
                (!periodoEspecifico || disp.periodos.includes(periodoEspecifico))) {
              for (const p of disp.periodos) {
                if (!periodoEspecifico || p === periodoEspecifico) {
                  alternativas.push({
                    data: disp.data,
                    periodo: p,
                    id_tecnico: idTec,
                    ocupacao: ocupadosPorTecnico[idTec]?.[disp.data]?.[p] || 0,
                    limite: limiteAgendamentos[p]
                  });
                }
              }
            }
          }
        } else {
          // Adicionar todas as opções disponíveis se não houver filtros
          for (const disp of datasDisponiveis) {
            for (const p of disp.periodos) {
              alternativas.push({
                data: disp.data,
                periodo: p,
                id_tecnico: idTec,
                ocupacao: ocupadosPorTecnico[idTec]?.[disp.data]?.[p] || 0,
                limite: limiteAgendamentos[p]
              });
            }
          }
        }
      }
    }

    if (alternativas.length === 0) {
      console.log('Nenhuma alternativa de agendamento encontrada');
      return { sugestao: null, alternativas: [] };
    }

    // Ordenar por data, período e ocupação
    alternativas.sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data);
      if (a.periodo !== b.periodo) return a.periodo.localeCompare(b.periodo);
      return a.ocupacao - b.ocupacao;
    });

    // Escolher a sugestão principal com base na prioridade
    let sugestao;
    if (dataEspecifica || periodoEspecifico) {
      // Se data/período específico foi solicitado, pegar a primeira opção disponível
      sugestao = alternativas[0];
    } else if (prioridade === 0) { 
      // Prioridade 0: Agendar o mais rápido possível
      sugestao = alternativas[0];
    } else if (prioridade === 1) {
      // Prioridade 1: Agendar no meio do período 
      const idx = Math.floor(alternativas.length / 2);
      sugestao = alternativas[idx];
    } else {
      // Prioridade 2 ou outro: Agendar no final do período
      sugestao = alternativas[alternativas.length - 1];
    }

    console.log('Sugestão principal:', sugestao);
    console.log('Total de alternativas:', alternativas.length);
    return { sugestao, alternativas };
    
  } catch (error) {
    console.error('Erro ao gerar sugestões de agendamento:', error);
    return { sugestao: null, alternativas: [] };
  }
}

module.exports = {
  getTecnicosPorSetor,
  filtrarTecnicosPorSetor,
  gerarSugestoesDeAgendamentoV2
};
