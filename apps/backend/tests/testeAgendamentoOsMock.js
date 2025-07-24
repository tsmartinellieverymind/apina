/**
 * Teste de agendamento de OS com dados mockados
 * 
 * Este script implementa uma versão modificada da função gerarSugestoesDeAgendamento
 * que trabalha apenas com dados mockados, sem fazer chamadas à API.
 */

const dayjs = require('dayjs');
const isBetween = require('dayjs/plugin/isBetween');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const fs = require('fs');
const path = require('path');

// Importar configurações de agendamento diretamente do JS
const configuracoesAgendamento = require('../app/data/configuracoes_agendamentos.js');

// Lista de feriados nacionais fixos (formato MM-DD)
const feriadosFixos = [
  '01-01', // Ano Novo
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '12-25'  // Natal
];

// Função para verificar se uma data é feriado
function isFeriado(data) {
  const mmdd = data.format('MM-DD');
  return feriadosFixos.includes(mmdd);
}

// Função para verificar se é dia útil (não é final de semana nem feriado)
function isDiaUtil(data) {
  const diaSemana = data.day();
  // 0 = domingo, 6 = sábado
  return diaSemana !== 0 && diaSemana !== 6 && !isFeriado(data);
}

// Função para obter o próximo dia útil a partir de uma data
function getProximoDiaUtil(data) {
  let proximaData = data.add(1, 'day');
  while (!isDiaUtil(proximaData)) {
    proximaData = proximaData.add(1, 'day');
  }
  return proximaData;
}

dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

/**
 * Gera sugestões de agendamento para uma OS
 * @param {Object} os - Objeto da OS
 * @param {Array} osAgendadasColecao - Coleção de OS já agendadas
 * @param {number} prioridade - Prioridade do agendamento (0: mais rápido, 1: metade do período, 2: último dia)
 * @param {string} dataMinima - Data mínima para agendamento (formato YYYY-MM-DD, opcional)
 * @param {string} dataMaxima - Data máxima para agendamento (formato YYYY-MM-DD, opcional)
 * @param {string} idTecnico - ID do técnico para o qual queremos verificar disponibilidade
 * @returns {Object} Objeto com sugestão principal e alternativas
 */
async function gerarSugestoesDeAgendamentoMock(os, osAgendadasColecao, prioridade = null, dataMinima = null, dataMaxima = null, idTecnico = null) {
  console.log('====[ gerarSugestoesDeAgendamentoMock ]====');
  console.log(`OS ID: ${os.id}, Setor: ${os.setor}, Prioridade: ${prioridade}, Técnico: ${idTecnico || 'Todos'}`);

  // Obter configurações de agendamento baseadas no assunto da OS
  const configOS = getConfiguracoesAgendamentoOS(os);
  
  // Usar valores da configuração se não forem especificados
  prioridade = prioridade !== null ? prioridade : configOS.prioridade;
  
  // Definir período de busca (data mínima até data máxima)
  const dataMinimaObj = dataMinima ? dayjs(dataMinima) : getDataMinimaAgendamento(os);
  const dataAberturaOS = os.data_abertura ? dayjs(os.data_abertura) : dayjs();
  const dataMaximaObj = dataMaxima ? dayjs(dataMaxima) : getDataMaximaAgendamento(os);
  
  console.log(`Data mínima: ${dataMinimaObj.format('DD/MM/YYYY')}`);
  console.log(`Data máxima: ${dataMaximaObj.format('DD/MM/YYYY')}`);
  console.log(`Prioridade: ${prioridade}`);
  const periodos = ['M', 'T']; // M = manhã, T = tarde
  
  // Carregar vínculos de técnicos com setores
  const vinculos = JSON.parse(fs.readFileSync(path.join(__dirname, './data/vinculos_tecnicos_setores.json'), 'utf8'));
  
  // Corrigir campo de setor (garantir que seja string)
  const setor = String(os.id_setor || os.setor_id || os.setor);
  
  try {
    // 1. Filtrar OS agendadas do mesmo setor, status 'AG', dentro do SLA
    console.log(`[1] Filtrando OS agendadas do setor: ${os.setor}`);
    
    // Converter os IDs de técnicos e setores para números para comparação correta
    const setorNum = parseInt(setor);
    
    // 2. Filtrar OS agendadas, dentro do período definido
    // Verificar se já temos uma coleção de OS agendadas, caso contrário, usar uma lista vazia
    const agendadas = Array.isArray(osAgendadasColecao) ? osAgendadasColecao.filter(o => 
      o.status === 'AG' &&
      o.data_agenda_final &&
      dayjs(o.data_agenda_final).isBetween(dataMinimaObj, dataMaximaObj, null, '[]') &&
      o.id_tecnico
    ) : [];
    console.log('[2] Total de OS agendadas consideradas:', agendadas.length);

    // 3. Montar períodos ocupados por técnico e data
    const ocupadosPorTecnico = {};
    for (const o of agendadas) {
      const idTec = o.id_tecnico;
      const data = dayjs(o.data_agenda_final).format('YYYY-MM-DD');
      const periodo = o.melhor_horario_agenda || 'M'; // Usa 'M' como padrão se não especificado
      
      if (!ocupadosPorTecnico[idTec]) ocupadosPorTecnico[idTec] = {};
      if (!ocupadosPorTecnico[idTec][data]) ocupadosPorTecnico[idTec][data] = { M: 0, T: 0 };
      
      // Incrementa o contador de agendamentos para o período
      ocupadosPorTecnico[idTec][data][periodo]++;
    }

    // 4. Buscar técnicos vinculados ao setor
    console.log('[3] Buscando técnicos vinculados ao setor:', setor);
    
    // Se um técnico específico foi informado, verificamos apenas ele
    let tecnicosSetor = [];
    if (idTecnico) {
      // Verificar se o técnico está vinculado ao setor
      if (vinculos[idTecnico] && vinculos[idTecnico].includes(parseInt(setor))) {
        tecnicosSetor = [idTecnico];
      }
    } else {
      // Buscar todos os técnicos vinculados ao setor
      tecnicosSetor = Object.keys(vinculos).filter(tecId => 
        Array.isArray(vinculos[tecId]) && 
        vinculos[tecId].includes(parseInt(setor))
      );
    }
    
    // Se não encontrou nenhum técnico, simular alguns para teste
    if (tecnicosSetor.length === 0) {
      console.log('[4.1] Nenhum técnico encontrado, usando técnicos simulados para teste');
      tecnicosSetor = ['1', '4', '5', '8', '10'];
    }
    
    console.log('[4] Técnicos vinculados ao setor:', tecnicosSetor);

    // 5. Gerar períodos disponíveis para cada técnico
    const sugestoes = [];
    for (const idTec of tecnicosSetor) {
      console.log(`[5] Gerando períodos disponíveis para técnico ${idTec}`);
      const datasDisponiveis = [];
      let dia = dataMinimaObj.clone();
      
      // Limite de agendamentos por período
      const limiteAgendamentos = {
        M: 2, // 2 agendamentos pela manhã
        T: 3  // 3 agendamentos pela tarde
      };
      
      while (dia.isBefore(dataMaximaObj, 'day') || dia.isSame(dataMaximaObj, 'day')) {
        // Verificar se é dia útil (não é final de semana nem feriado)
        if (isDiaUtil(dia)) {
          const dataStr = dia.format('YYYY-MM-DD');
          const ocupados = ocupadosPorTecnico[idTec]?.[dataStr] || { M: 0, T: 0 };
          const periodosDisponiveis = [];
          
          // Verificar períodos disponíveis
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
        sugestoes.push({ id_tecnico: idTec, datasDisponiveis });
      }
    }

    // 6. Montar lista de alternativas (uma por período disponível)
    const alternativas = [];
    for (const sug of sugestoes) {
      for (const d of sug.datasDisponiveis) {
        for (const periodo of d.periodos) {
          alternativas.push({
            id_tecnico: sug.id_tecnico,
            data: d.data,
            periodo
          });
        }
      }
    }

    console.log('[6] Total de alternativas geradas:', alternativas.length);
    
    // 7. Escolher a melhor sugestão conforme prioridade
    let sugestao = null;
    if (alternativas.length > 0) {
      if (prioridade === 0) {
        // Mais rápido possível
        sugestao = alternativas[0];
      } else if (prioridade === 1) {
        // Pelo menos metade do SLA
        const metadeSLA = dataAberturaOS.add(5, 'day');
        sugestao = alternativas.find(a => dayjs(a.data).isAfter(metadeSLA.startOf('day'))) || alternativas[alternativas.length - 1];
      } else if (prioridade === 2) {
        // Último dia do SLA
        const ultimoDia = dataMaximaObj.startOf('day').format('YYYY-MM-DD');
        const doUltimoDia = alternativas.filter(a => a.data === ultimoDia);
        sugestao = doUltimoDia.length > 0 ? doUltimoDia[0] : alternativas[alternativas.length - 1];
      } else {
        sugestao = alternativas[0];
      }
    }

    console.log('[7] Sugestão principal:', sugestao);
    return {
      sugestao,
      alternativas
    };
  } catch (error) {
    console.error('❌ Erro em gerarSugestoesDeAgendamentoMock:', error);
    return null;
  }
}

/**
 * Função principal para testar o agendamento
 * @param {Object} os - Objeto da OS a ser agendada
 * @param {Array} osAgendadas - Coleção de OS já agendadas
 * @param {number} slaHoras - SLA em horas (padrão: 72)
 * @param {number} prioridade - Prioridade do agendamento (0: mais rápido, 1: metade do SLA, 2: último dia)
 * @param {string} idTecnico - ID do técnico (opcional)
 */
async function testarAgendamentoMock(os, osAgendadas, prioridade = 0, dataMinima = null, dataMaxima = null, idTecnico = null) {
  console.log('\n==== TESTE DE AGENDAMENTO DE OS (MOCK) ====');
  console.log(`OS ID: ${os.id}`);
  console.log(`Assunto: ${os.mensagem}`);
  console.log(`Setor: ${os.setor}`);
  console.log(`SLA: ${72} horas`);
  console.log(`Prioridade: ${prioridade}`);
  console.log(`Técnico: ${idTecnico || 'Todos'}`);
  console.log('==========================================\n');

  try {
    // Gerar sugestões de agendamento
    const sugestoes = await gerarSugestoesDeAgendamentoMock(os, osAgendadas, prioridade, dataMinima, dataMaxima, idTecnico);
    
    if (!sugestoes || !sugestoes.sugestao) {
      console.log('❌ Nenhuma sugestão de agendamento disponível.');
      return;
    }

    // Exibir a sugestão principal
    const { sugestao, alternativas } = sugestoes;
    console.log('\n==== SUGESTÃO PRINCIPAL ====');
    console.log(`Técnico: ${sugestao.id_tecnico}`);
    console.log(`Data: ${dayjs(sugestao.data).format('DD/MM/YYYY')}`);
    console.log(`Período: ${sugestao.periodo === 'M' ? 'Manhã' : 'Tarde'}`);
    console.log('============================\n');

    // Exibir alternativas (limitado a 5 para não poluir o console)
    if (alternativas && alternativas.length > 0) {
      console.log('\n==== ALTERNATIVAS ====');
      const limitadas = alternativas.slice(0, 5);
      limitadas.forEach((alt, idx) => {
        console.log(`${idx + 1}. Técnico ${alt.id_tecnico} - ${dayjs(alt.data).format('DD/MM/YYYY')} - ${alt.periodo === 'M' ? 'Manhã' : 'Tarde'}`);
      });
      if (alternativas.length > 5) {
        console.log(`... e mais ${alternativas.length - 5} alternativas`);
      }
      console.log('=====================\n');
    }

    return sugestoes;
  } catch (error) {
    console.error('❌ Erro ao testar agendamento:', error);
  }
}

/**
 * Verifica se uma data específica está disponível para agendamento
 * @param {Object} os - Objeto da OS
 * @param {string} data - Data para verificar (formato YYYY-MM-DD)
 * @param {string} periodo - Período (M: manhã, T: tarde)
 * @param {string} idTecnico - ID do técnico (opcional)
 * @param {string} dataMinima - Data mínima para agendamento (formato YYYY-MM-DD, opcional)
 * @param {number} prazoMaximoDias - Prazo máximo em dias úteis para agendamento (opcional)
 * @returns {Promise<Object>} Resultado da verificação
 */
async function verificarDisponibilidadeDataMock(os, data, periodo, idTecnico = null, dataMinima = null, prazoMaximoDias = null) {
  // Verificar se a data é válida
  const dataObj = dayjs(data);
  if (!dataObj.isValid()) {
    return {
      disponivel: false,
      mensagem: `Data ${data} inválida.`,
      alternativas: []
    };
  }

  // Obter configurações de agendamento baseadas no assunto da OS
  const configOS = getConfiguracoesAgendamentoOS(os);
  
  // Usar valores da configuração se não forem especificados
  prazoMaximoDias = prazoMaximoDias !== null ? prazoMaximoDias : configOS.prazoMaximoAgendamentoDias;
  
  // Verificar se é dia útil
  if (!isDiaUtil(dataObj)) {
    return {
      disponivel: false,
      mensagem: `Data ${data} não é um dia útil.`,
      alternativas: []
    };
  }

  // Definir data mínima e máxima para agendamento
  const dataMinimaObj = dataMinima ? dayjs(dataMinima) : getDataMinimaAgendamento(os);
  const dataAberturaOS = os.data_abertura ? dayjs(os.data_abertura) : dayjs();
  
  // Calcular data máxima contando apenas dias úteis
  let dataMaximaObj = dataAberturaOS.clone();
  let diasUteisContados = 0;
  
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
      mensagem: `Data ${data} está antes da data mínima permitida (${dataMinimaObj.format('YYYY-MM-DD')}).`,
      alternativas: []
    };
  }
  
  if (dataObj.isAfter(dataMaximaObj, 'day')) {
    return {
      disponivel: false,
      mensagem: `Data ${data} está após o prazo máximo de ${prazoMaximoDias} dias úteis (${dataMaximaObj.format('YYYY-MM-DD')}).`,
      alternativas: []
    };
  }

  // Carregar dados mockados
  const mockOsAdicionais = require('./app/data/mock_ordens_servico_adicionais');
  
  // Filtrar apenas as OS agendadas
  const osAgendadas = mockOsAdicionais.registros.filter(item => 
    item.status === 'AG' && 
    item.data_agenda_final && 
    item.data_agenda_final !== '' && 
    item.id_tecnico && 
    item.id_tecnico !== ''
  );

  // Carregar vínculos de técnicos com setores
  const vinculos = JSON.parse(fs.readFileSync(path.join(__dirname, './data/vinculos_tecnicos_setores.json'), 'utf8'));
  
  // Obter técnicos vinculados ao setor da OS
  const setor = String(os.id_setor || os.setor_id || os.setor);
  let tecnicosDisponiveis = idTecnico ? [idTecnico] : null;
  
  if (!tecnicosDisponiveis) {
    // Se não foi fornecida uma lista de técnicos, buscar técnicos do setor
    // O arquivo de vínculos está no formato { "setor": ["id_tecnico1", "id_tecnico2", ...] }
    const tecnicosSetor = vinculos[setor] || [];
    tecnicosDisponiveis = tecnicosSetor.length > 0 ? tecnicosSetor : ['1', '4', '5', '8', '10']; // Técnicos simulados se não encontrar
  }

  // Verificar disponibilidade para cada técnico na data/período especificado
  const limiteAgendamentos = { M: 2, T: 3 }; // 2 pela manhã, 3 à tarde
  const dataStr = dataObj.format('YYYY-MM-DD');
  const disponibilidadeTecnicos = [];

  for (const idTecnico of tecnicosDisponiveis) {
    // Contar quantas OS já estão agendadas para este técnico nesta data/período
    const agendadasTecnico = osAgendadas.filter(o => {
      const oData = dayjs(o.data_agenda_final).format('YYYY-MM-DD');
      const oPeriodo = o.melhor_horario_agenda || 'M';
      return o.id_tecnico === idTecnico && oData === dataStr && oPeriodo === periodo;
    });

    const ocupados = agendadasTecnico.length;
    const disponivel = ocupados < limiteAgendamentos[periodo];

    if (disponivel) {
      disponibilidadeTecnicos.push({
        id_tecnico: idTecnico,
        disponivel: true,
        ocupados,
        limite: limiteAgendamentos[periodo]
      });
    }
  }

  // Se não houver técnicos disponíveis, gerar alternativas
  if (disponibilidadeTecnicos.length === 0) {
    // Usar a função existente para gerar sugestões alternativas
    const sugestoes = await gerarSugestoesDeAgendamentoMock(os, osAgendadas, 0, dataMinimaObj.format('YYYY-MM-DD'), dataMaximaObj.format('YYYY-MM-DD'));
    
    return {
      disponivel: false,
      mensagem: `Data ${data} - ${periodo === 'M' ? 'Manhã' : 'Tarde'} não disponível para agendamento.`,
      alternativas: sugestoes.alternativas.slice(0, 3).map(alt => ({
        data: alt.data,
        periodo: alt.periodo,
        id_tecnico: alt.id_tecnico
      }))
    };
  }

  // Retornar o primeiro técnico disponível
  return {
    disponivel: true,
    mensagem: `Data ${data} - ${periodo === 'M' ? 'Manhã' : 'Tarde'} disponível para agendamento.`,
    tecnico: disponibilidadeTecnicos[0].id_tecnico,
    alternativas: []
  };
}

module.exports = { 
  gerarSugestoesDeAgendamentoMock,
  testarAgendamentoMock,
  isDiaUtil,
  isFeriado,
  getProximoDiaUtil,
  verificarDisponibilidadeDataMock
};
