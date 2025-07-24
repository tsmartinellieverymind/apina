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
  // Tentar caminhos possíveis para o arquivo
  const caminhosPossiveis = [
    path.join(__dirname, '../app/data/configuracoes_agendamentos.js'), // Caminho correto com 's' e .js
    path.join(process.cwd(), 'app/data/configuracoes_agendamentos.js'),
    path.join(process.cwd(), 'backend/app/data/configuracoes_agendamentos.js')
  ];
  
  let configPath = null;
  let arquivoEncontrado = false;
  
  // Verificar cada caminho possível
  for (const caminho of caminhosPossiveis) {
    if (fs.existsSync(caminho)) {
      configPath = caminho;
      arquivoEncontrado = true;
      console.log(`[INFO] Arquivo de configurações de agendamento encontrado em: ${configPath}`);
      break;
    }
  }
  
  if (!arquivoEncontrado) {
    throw new Error(`Arquivo de configurações de agendamento não encontrado em nenhum dos caminhos: ${caminhosPossiveis.join(', ')}`);
  }
  
  // Como é um arquivo .js, usamos require em vez de fs.readFile
  configuracoes = require(configPath);
} catch (error) {
  console.error('Erro ao carregar configurações de agendamento:', error.message);
  throw new Error(`Não foi possível carregar as configurações de agendamento: ${error.message}`);
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

/**
 * Retorna os vínculos entre setores e técnicos
 * @returns {Object} Objeto com a estrutura: { idSetor: [idTecnico1, idTecnico2, ...] }
 * @throws {Error} Se o arquivo não for encontrado
 */
async function vinculosTecnicoSetor() {
  try {
    console.log('[DEBUG] vinculosTecnicoSetor: Iniciando carregamento de vínculos de técnicos e setores');

    // Tentar caminhos possíveis para o arquivo
    const caminhosPossiveis = [
      path.join(__dirname, '../app/data/vinculos_setores_tecnicos.json'),
      path.join(process.cwd(), 'app/data/vinculos_setores_tecnicos.json'),
      path.join(process.cwd(), 'backend/app/data/vinculos_setores_tecnicos.json')
    ];
    
    console.log('[DEBUG] vinculosTecnicoSetor: Tentando encontrar arquivo de vínculos em caminhos possíveis:', caminhosPossiveis);
    
    let vinculosPath = null;
    let arquivoEncontrado = false;
    
    // Verificar cada caminho possível
    for (const caminho of caminhosPossiveis) {
      console.log('[DEBUG] vinculosTecnicoSetor: Verificando caminho:', caminho);
      if (fs.existsSync(caminho)) {
        console.log('[DEBUG] vinculosTecnicoSetor: Arquivo encontrado em:', caminho);
        vinculosPath = caminho;
        arquivoEncontrado = true;
        break;
      } else {
        console.log('[DEBUG] vinculosTecnicoSetor: Arquivo não encontrado em:', caminho);
      }
    }
    
    if (!arquivoEncontrado) {
      console.error('[ERROR] vinculosTecnicoSetor: Arquivo de vínculos não encontrado em nenhum dos caminhos possíveis');
      return null;
    }
    
    // Carregar e parsear o arquivo
    console.log('[DEBUG] vinculosTecnicoSetor: Carregando conteúdo do arquivo:', vinculosPath);
    const conteudo = fs.readFileSync(vinculosPath, 'utf8');
    console.log('[DEBUG] vinculosTecnicoSetor: Conteúdo do arquivo (primeiros 100 caracteres):', conteudo.substring(0, 100));
    let vinculos;
    try {
      vinculos = JSON.parse(conteudo);
      console.log('[DEBUG] vinculosTecnicoSetor: Arquivo parseado com sucesso.');
      console.log('[DEBUG] vinculosTecnicoSetor: Tipo de dado parseado:', typeof vinculos);
      console.log('[DEBUG] vinculosTecnicoSetor: Estrutura do dado parseado:', JSON.stringify(Object.keys(vinculos).slice(0, 5), null, 2));
      if (Array.isArray(vinculos)) {
        console.log('[DEBUG] vinculosTecnicoSetor: Total de vínculos (array length):', vinculos.length);
        console.log('[DEBUG] vinculosTecnicoSetor: Primeiros 5 vínculos (ou menos):', JSON.stringify(vinculos.slice(0, 5), null, 2));
      } else {
        console.log('[DEBUG] vinculosTecnicoSetor: Dado parseado não é um array, convertendo para formato esperado se possível');
        // Check if it's an object with sector IDs as keys
        if (typeof vinculos === 'object' && vinculos !== null) {
          console.log('[DEBUG] vinculosTecnicoSetor: Chaves do objeto (primeiras 5):', Object.keys(vinculos).slice(0, 5));
          // If it's an object with sector IDs, return it as is
          return vinculos;
        } else {
          console.error('[ERROR] vinculosTecnicoSetor: Formato de dado inesperado, não é array nem objeto utilizável');
          return null;
        }
      }
    } catch (parseError) {
      console.error('[ERROR] vinculosTecnicoSetor: Erro ao parsear JSON:', parseError.message);
      return null;
    }
    
    return vinculos;
  } catch (error) {
    console.error('[ERROR] vinculosTecnicoSetor: Erro ao carregar vínculos de técnicos e setores:', error.message);
    return null;
  }
}

module.exports = {
  getConfiguracaoAgendamento,
  getDataMinimaAgendamento,
  getDataMaximaAgendamento,
  getPrioridadeAgendamento,
  getConfiguracoesAgendamentoOS,
  vinculosTecnicoSetor
};
