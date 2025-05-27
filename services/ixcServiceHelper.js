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
    // Verificar se estamos recebendo o ID do setor corretamente
    console.log(`[DEBUG] getTecnicosPorSetor chamado com idSetor: '${idSetor}' (tipo: ${typeof idSetor})`);
    
    // Importar arquivo de vínculos
    const vinculosTecnicoSetor = require('../app/data/vinculos_setores_tecnicos.json');
    
    // Garantir que idSetor seja uma string
    const idSetorStr = String(idSetor);
    console.log(`[DEBUG] ID do setor convertido para string: '${idSetorStr}'`);
    
    // Obter técnicos vinculados ao setor do arquivo
    const tecnicosDoSetor = vinculosTecnicoSetor[idSetorStr] || [];
    console.log(`[DEBUG] Técnicos vinculados ao setor ${idSetorStr} (do arquivo):`, tecnicosDoSetor);
    
    return tecnicosDoSetor;
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
  console.log(`[4.1] Filtrando técnicos para o setor ${idSetor} (tipo: ${typeof idSetor})`);
  console.log(`[4.1] Total de técnicos ativos na API:`, tecnicosApi.length);
  console.log(`[4.1] IDs dos técnicos ativos na API:`, tecnicosApi.map(t => t.id));
  
  // VERIFICAÇÃO CRÍTICA: Estamos usando o setor correto?
  if (idSetor === null || idSetor === undefined) {
    console.error(`[ERRO] ID do setor é ${idSetor}! Não é possível filtrar técnicos.`);
    return [];
  }
  
  // Garantir que idSetor seja uma string
  const idSetorStr = String(idSetor);
  console.log(`[4.1] ID do setor convertido para string: '${idSetorStr}'`);
  
  try {
    // Obter técnicos vinculados ao setor do arquivo
    const vinculosTecnicoSetor = require('../app/data/vinculos_setores_tecnicos.json');
    const idsTecnicosVinculados = vinculosTecnicoSetor[idSetorStr] || [];
    console.log(`[4.1] IDs dos técnicos vinculados ao setor ${idSetorStr} (do arquivo):`, idsTecnicosVinculados);
    
    // Filtrar técnicos ativos que estão vinculados ao setor
    const tecnicosDoSetor = tecnicosApi.filter(t => 
      idsTecnicosVinculados.includes(String(t.id))
    );
    console.log(`[4.1] Técnicos ativos e vinculados ao setor ${idSetorStr}:`, tecnicosDoSetor.map(t => t.id));
    
    return tecnicosDoSetor.map(t => t.id);
  } catch (error) {
    console.error(`[ERRO] Falha ao filtrar técnicos para o setor ${idSetorStr}:`, error.message);
    // Como não conseguimos obter os vínculos, retornamos um array vazio
    // para indicar que não há técnicos disponíveis para este setor
    return [];
  }
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
  
  console.log('[LOG] prioridade:', prioridade);
  console.log('[LOG] diasMin:', diasMin);
  console.log('[LOG] diasMax:', diasMax);

  // Calcular data mínima
  let dataMinimaObj;
  
  // Se foi especificada uma data, usar essa data como mínima
  if (dataEspecifica && dayjs(dataEspecifica).isValid()) {
    dataMinimaObj = dayjs(dataEspecifica);
    console.log(`[DEBUG] Usando data especificada como mínima: ${dataMinimaObj.format('DD/MM/YYYY')}`);
  } else {
    const hoje = dayjs();
    console.log(`[DEBUG] Data atual: ${hoje.format('DD/MM/YYYY')}`);
    
    dataMinimaObj = hoje.clone(); // Começa de hoje
    console.log(`[DEBUG] Data base para cálculo da mínima: ${dataMinimaObj.format('DD/MM/YYYY')}`);
    
    if (diasMin > 0) {
        dataMinimaObj = dataMinimaObj.add(diasMin, 'day');
        console.log(`[DEBUG] Após adicionar ${diasMin} dias: ${dataMinimaObj.format('DD/MM/YYYY')}`);
    }
    
    // Garante que a data mínima seja um dia útil
    if (!isDiaUtil(dataMinimaObj)) {
        const dataAntes = dataMinimaObj.clone();
        while (!isDiaUtil(dataMinimaObj)) {
            dataMinimaObj = dataMinimaObj.add(1, 'day');
        }
        console.log(`[DEBUG] Ajustando para dia útil: ${dataAntes.format('DD/MM/YYYY')} -> ${dataMinimaObj.format('DD/MM/YYYY')}`);
    } else {
        console.log(`[DEBUG] Data já é um dia útil: ${dataMinimaObj.format('DD/MM/YYYY')}`);
    }
  }

  // Calcular data máxima
  let dataMaximaObj;
  
  // Se foi especificada uma data, usar essa data como máxima também
  if (dataEspecifica && dayjs(dataEspecifica).isValid()) {
    dataMaximaObj = dayjs(dataEspecifica);
  } else {
    // CORREÇÃO: Usar a data mínima como base para o cálculo da data máxima
    // Isso garante que o intervalo entre data mínima e máxima seja sempre de diasMax dias
    console.log(`[DEBUG] Usando data mínima (${dataMinimaObj.format('DD/MM/YYYY')}) como base para cálculo da data máxima`);
    
    // Adicionar diasMax dias corridos (não apenas dias úteis) à data mínima
    dataMaximaObj = dataMinimaObj.clone().add(diasMax, 'day');
    
    // Garantir que a data máxima seja um dia útil
    while (!isDiaUtil(dataMaximaObj)) {
      dataMaximaObj = dataMaximaObj.subtract(1, 'day'); // Voltar um dia até encontrar um dia útil
    }
    
    console.log(`[DEBUG] Data máxima calculada: ${dataMaximaObj.format('DD/MM/YYYY')} (${diasMax} dias após a data mínima)`);
    
    // REMOVER QUALQUER VERIFICAÇÃO QUE LIMITE A DATA MÁXIMA A APENAS UM DIA APÓS A MÍNIMA
    // NÃO AJUSTAR A DATA MÁXIMA PARA APENAS UM DIA ÚTIL APÓS A MÍNIMA
  }

  // Resumo das datas calculadas para análise
  console.log(`[LOG] Datas para análise: mínima=${dataMinimaObj.format('YYYY-MM-DD')}, máxima=${dataMaximaObj.format('YYYY-MM-DD')}`);
  console.log(`Data mínima calculada: ${dataMinimaObj.format('DD/MM/YYYY')}`);
  console.log(`Data máxima calculada: ${dataMaximaObj.format('DD/MM/YYYY')}`);
  
  // Verificar se a data máxima é pelo menos diasMax dias após a data mínima
  const diasDiferenca = dataMaximaObj.diff(dataMinimaObj, 'day');
  if (diasDiferenca < diasMax - 1) { // -1 porque pode perder um dia ao ajustar para dia útil
    // Recalcular a data máxima para garantir que seja pelo menos diasMax dias após a data mínima
    dataMaximaObj = dataMinimaObj.clone().add(diasMax, 'day');
    // Garantir que a data máxima seja um dia útil
    while (!isDiaUtil(dataMaximaObj)) {
      dataMaximaObj = dataMaximaObj.subtract(1, 'day'); // Voltar um dia até encontrar um dia útil
    }
    console.log(`[INFO] Data máxima reajustada para ${dataMaximaObj.format('DD/MM/YYYY')} para garantir intervalo de ${diasMax} dias.`);
  }

  // Extrair o setor da OS
  console.log('[DEBUG] Campos de setor na OS:', {
    id_setor: os.id_setor,
    setor_id: os.setor_id,
    setor: os.setor
  });
  
  const setor = String(os.id_setor || os.setor_id || os.setor);
  console.log(`[DEBUG] Setor extraído da OS: '${setor}' (tipo: ${typeof setor})`);
  
  // Verificar se o setor existe e tem técnicos vinculados
  try {
    const vinculosTecnicoSetor = require('../app/data/vinculos_setores_tecnicos.json');
    const idsTecnicosVinculados = vinculosTecnicoSetor[setor] || [];
    console.log(`[DEBUG] IDs dos técnicos vinculados ao setor ${setor} (verificação prévia):`, idsTecnicosVinculados);
    
    if (!idsTecnicosVinculados || idsTecnicosVinculados.length === 0) {
      console.log(`[ALERTA] Setor ${setor} não tem técnicos vinculados. Não é possível gerar sugestões.`);
      return { sugestao: null, alternativas: [] };
    }
  } catch (error) {
    console.error(`[ERRO] Falha ao verificar técnicos do setor ${setor}:`, error.message);
    return { sugestao: null, alternativas: [] };
  }
  
  try {
    // 1. Buscar todos os técnicos ativos (id_funcao=2) na API
    const bodyTec = new URLSearchParams();
    console.log('[1] Buscando técnicos ativos (id_funcao=2) na API...');
    bodyTec.append('qtype', 'funcionarios.id'); // buscar todos
    bodyTec.append('query', '0');
    bodyTec.append('oper', '!=');
    bodyTec.append('page', '1');
    bodyTec.append('rp', '1000');
    bodyTec.append('sortname', 'funcionarios.id');
    bodyTec.append('sortorder', 'asc');
    bodyTec.append('filter', JSON.stringify({ ativo: 'S', id_funcao: '2' }));
    
    const respTec = await api.post('/funcionarios', bodyTec, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ixcsoft: 'listar' }
    });
    const tecnicosApi = Object.values(respTec.data?.registros || {});
    
    // 2. FILTRAR PRIMEIRO: Filtrar técnicos que pertencem ao setor usando a estrutura de vínculos
    console.log('[2] Filtrando técnicos pelo setor antes de verificar disponibilidade');
    const vinculosTecnicoSetor = require('../app/data/vinculos_setores_tecnicos.json');
    const idsTecnicosVinculados = vinculosTecnicoSetor[setor] || [];
    
    // Verificar se o setor tem técnicos vinculados
    if (!idsTecnicosVinculados || idsTecnicosVinculados.length === 0) {
      console.log(`[2] ALERTA: Setor ${setor} não tem técnicos vinculados no JSON. Retornando sem sugestões.`);
      return { sugestao: null, alternativas: [] };
    }
    
    const tecnicosSetor = tecnicosApi.filter(t => 
      idsTecnicosVinculados.includes(String(t.id))
    );
    console.log('[2] Técnicos ativos e vinculados ao setor:', tecnicosSetor.map(t => t.id));
    
    if (!tecnicosSetor || tecnicosSetor.length === 0) {
      console.error(`[ERRO] Nenhum técnico vinculado ao setor ${setor}. Não é possível sugerir datas.`);
      return { sugestao: null, alternativas: [] };
    }
    
    // 3. Buscar OS agendadas do mesmo setor, status 'AG', dentro do período definido
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
    console.log('[3] Total de OS agendadas consideradas:', osAgendadas.length);
    
    // 4. Montar períodos ocupados por técnico e data
    // OTIMIZAÇÃO: Só calcular para os técnicos já filtrados pelo setor
    const ocupadosPorTecnico = {};
    const idsTecnicos = tecnicosSetor.map(t => t.id);
    
    for (const o of osAgendadas) {
      const idTec = o.id_tecnico;
      // Só considerar OS dos técnicos do setor
      if (!idsTecnicos.includes(idTec)) continue;
      
      const data = dayjs(o.data_agenda_final).format('YYYY-MM-DD');
      const hora = dayjs(o.data_agenda_final).format('HH:mm:ss');
      const periodo = o.melhor_horario_agenda || (parseInt(hora) < 12 ? 'M' : 'T'); // Usa 'M' ou 'T' baseado na hora
      
      if (!ocupadosPorTecnico[idTec]) ocupadosPorTecnico[idTec] = {};
      if (!ocupadosPorTecnico[idTec][data]) ocupadosPorTecnico[idTec][data] = { M: 0, T: 0 };
      ocupadosPorTecnico[idTec][data][periodo]++;
    }
    console.log('[4] Mapeamento de ocupação por técnico concluído');
  } catch (e) {
    console.error('Erro ao buscar técnicos ativos:', e.message);
    return { sugestao: null, alternativas: [] };
  }

    // 5. Gerar períodos disponíveis por técnico
    const alternativas = [];
    const limiteAgendamentos = { M: 2, T: 3 }; // 2 pela manhã, 3 à tarde
    
    for (const idTec of tecnicosSetor.map(t => t.id)) {
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
