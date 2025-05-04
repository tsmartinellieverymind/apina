/**
 * Utilitário para obter configurações de agendamento baseadas no assunto da OS
 */

const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { isDiaUtil, getProximoDiaUtil } = require('./ixcUtilsData');

// Carregar configurações de agendamento
let configuracoes;
try {
  // Tentar carregar do caminho relativo ao diretório services
  const configPath = path.join(__dirname, '../data/configuracoes_agendamento.json');
  configuracoes = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  try {
    // Tentar carregar do caminho absoluto da raiz do projeto
    const configPath = path.join(process.cwd(), 'data/configuracoes_agendamento.json');
    configuracoes = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error('Erro ao carregar configurações de agendamento:', error.message);
    // Usar configurações padrão caso o arquivo não seja encontrado
    configuracoes = {
      "assuntos": [
        {
          "id_assunto": "1",
          "tipo": "I",
          "descricao": "Instalação de internet fibra ótica",
          "dataMinimaAgendamentoDias": 1,
          "prazoMaximoAgendamentoDias": 10,
          "prioridade": 0
        }
      ],
      "default": {
        "dataMinimaAgendamentoDias": 1,
        "prazoMaximoAgendamentoDias": 10,
        "prioridade": 0
      }
    };
  }
}

/**
 * Obtém as configurações de agendamento para um assunto específico
 * @param {string} idAssunto - ID do assunto da OS
 * @param {string} tipo - Tipo da OS (I, S, R, M)
 * @returns {Object} Configurações de agendamento
 */
function getConfiguracaoAgendamento(idAssunto, tipo) {
  // Buscar configuração específica para o assunto
  const config = configuracoes.assuntos.find(a => 
    a.id_assunto === String(idAssunto) && 
    (a.tipo === String(tipo) || !tipo)
  );
  
  // Se não encontrar configuração específica, usar padrão
  return config || configuracoes.default;
}

/**
 * Calcula a data mínima para agendamento com base no assunto da OS
 * @param {Object} os - Objeto da OS
 * @returns {Object} Data mínima para agendamento (objeto dayjs)
 */
function getDataMinimaAgendamento(os) {
  const idAssunto = os.id_assunto;
  const tipo = os.tipo;
  
  // Obter configuração para o assunto
  const config = getConfiguracaoAgendamento(idAssunto, tipo);
  
  // Calcular data mínima
  let dataMinima = dayjs();
  
  // Adicionar dias conforme configuração
  if (config.dataMinimaAgendamentoDias > 0) {
    dataMinima = dataMinima.add(config.dataMinimaAgendamentoDias, 'day');
  }
  
  // Garantir que seja um dia útil
  if (!isDiaUtil(dataMinima)) {
    dataMinima = getProximoDiaUtil(dataMinima);
  }
  
  return dataMinima;
}

/**
 * Calcula a data máxima para agendamento com base no assunto da OS
 * @param {Object} os - Objeto da OS
 * @returns {Object} Data máxima para agendamento (objeto dayjs)
 */
function getDataMaximaAgendamento(os) {
  const idAssunto = os.id_assunto;
  const tipo = os.tipo;
  const dataAberturaOS = os.data_abertura ? dayjs(os.data_abertura) : dayjs();
  
  // Obter configuração para o assunto
  const config = getConfiguracaoAgendamento(idAssunto, tipo);
  
  // Calcular data máxima contando apenas dias úteis
  let dataMaxima = dataAberturaOS.clone();
  let diasUteisContados = 0;
  
  while (diasUteisContados < config.prazoMaximoAgendamentoDias) {
    dataMaxima = dataMaxima.add(1, 'day');
    if (isDiaUtil(dataMaxima)) {
      diasUteisContados++;
    }
  }
  
  return dataMaxima;
}

/**
 * Obtém a prioridade de agendamento com base no assunto da OS
 * @param {Object} os - Objeto da OS
 * @returns {number} Prioridade (0: mais rápido, 1: meio do período, 2: último dia)
 */
function getPrioridadeAgendamento(os) {
  const idAssunto = os.id_assunto;
  const tipo = os.tipo;
  
  // Obter configuração para o assunto
  const config = getConfiguracaoAgendamento(idAssunto, tipo);
  
  return config.prioridade;
}

/**
 * Obtém todas as configurações de agendamento para uma OS
 * @param {Object} os - Objeto da OS
 * @returns {Object} Configurações de agendamento
 */
function getConfiguracoesAgendamentoOS(os) {
  const idAssunto = os.id_assunto;
  const tipo = os.tipo;
  
  // Obter configuração para o assunto
  const config = getConfiguracaoAgendamento(idAssunto, tipo);
  
  // Calcular datas
  const dataMinima = getDataMinimaAgendamento(os);
  const dataMaxima = getDataMaximaAgendamento(os);
  
  return {
    dataMinimaAgendamento: dataMinima.format('YYYY-MM-DD'),
    prazoMaximoAgendamentoDias: config.prazoMaximoAgendamentoDias,
    dataMaximaAgendamento: dataMaxima.format('YYYY-MM-DD'),
    prioridade: config.prioridade,
    descricaoAssunto: config.descricao || 'Assunto não especificado'
  };
}

module.exports = {
  getConfiguracaoAgendamento,
  getDataMinimaAgendamento,
  getDataMaximaAgendamento,
  getPrioridadeAgendamento,
  getConfiguracoesAgendamentoOS
};
