/**
 * Job para atribuir setores às OS abertas
 * 
 * Este job é executado periodicamente para:
 * 1. Buscar OS abertas sem setor atribuído
 * 2. Determinar o setor correto com base no bairro e tipo de serviço
 * 3. Atualizar a OS com o setor determinado
 */

const cron = require('node-cron');
const mongoose = require('mongoose');
const ixcService = require('../services/ixcService');
const openaiService = require('../services/openaiService');
require('dotenv').config();

/**
 * Busca OSs abertas sem setor atribuído
 * @returns {Promise<Array>} Lista de OSs abertas sem setor
 */
async function buscarOSAbertas() {
  try {
    // Usando o serviço IXC para buscar as OSs abertas
    return await ixcService.buscarOSAbertas();
  } catch (error) {
    console.error('Erro ao buscar OSs abertas:', error.message);
    return [];
  }
}

/**
 * Busca detalhes do bairro e tipo de serviço da OS
 * @param {Object} os - Objeto da OS
 * @returns {Promise<Object>} Detalhes da OS
 */
async function buscarDetalhesOS(os) {
  try {
    // Usando o serviço IXC para buscar os detalhes da OS
    return await ixcService.buscarDetalhesOS(os);
  } catch (error) {
    console.error(`Erro ao buscar detalhes da OS ${os.id}:`, error.message);
    return null;
  }
}

// As funções buscarSetorPorBairro e findSetorByBairro foram movidas para o ixcService.js

/**
 * Atualiza a OS com o setor determinado
 * @param {string} osId - ID da OS
 * @param {string} setorId - ID do setor
 * @returns {Promise<boolean>} Sucesso da atualização
 */
async function atualizarOSComSetor(osId, setorId) {
  try {
    // Usando o serviço IXC para atualizar a OS com o setor
    return await ixcService.atualizarOSComSetor(osId, setorId);
  } catch (error) {
    console.error(`Erro ao atualizar OS ${osId} com o setor ${setorId}:`, error.message);
    return false;
  }
}

/**
 * Processa todas as OSs abertas sem setor
 */
// Número máximo de OS a processar por execução (ajuste conforme necessário ou use variável de ambiente)
const MAX_OS_PARA_PROCESSAR = process.env.MAX_OS_PARA_PROCESSAR ? parseInt(process.env.MAX_OS_PARA_PROCESSAR) : 10;

async function processarOSAbertas() {
  try {
    console.log('Iniciando processamento de OSs abertas sem setor...');
    
    // Conectar ao MongoDB para buscar a lista de bairros com seus setores
    await mongoose.connect(process.env.MONGO_URI, {
      tls: true,
      tlsAllowInvalidCertificates: true
    });
    
    // Buscar a lista de bairros com seus setores
    const db = mongoose.connection.useDb('IXC_SETORES');
    const setoresCollection = db.collection('setores');
    console.log('[DEBUG] Buscando lista de bairros/setores no MongoDB...');
    const listaBairros = await setoresCollection.find({}).toArray();
    console.log('[DEBUG] Resultado da busca de bairros/setores:', Array.isArray(listaBairros) ? `Total: ${listaBairros.length}` : typeof listaBairros);
    if (Array.isArray(listaBairros) && listaBairros.length > 0) {
      console.log('[DEBUG] Exemplo de setor:', JSON.stringify(listaBairros[0], null, 2));
    }
    
    console.log(`Encontrados ${listaBairros.length} bairros na coleção de setores.`);
    
    // Carregar configurações de agendamento para determinar o tipo de serviço
    const configuracoesAgendamento = require('../app/data/configuracoes_agendamentos');
    
    // Buscar OSs abertas sem setor atribuído
    let osAbertas = await buscarOSAbertas();
    
    if (osAbertas.length === 0) {
      console.log('Nenhuma OS para processar.');
      await mongoose.disconnect();
      return;
    }
    
    // Filtrar OSs que possuem bairro preenchido
    osAbertas = osAbertas.filter(os => !!os.bairro && os.bairro.trim() !== '');
    if (osAbertas.length === 0) {
      console.log('Nenhuma OS com bairro definido para processar.');
      await mongoose.disconnect();
      return;
    }
    // Limitar o número de OSs processadas
    osAbertas = osAbertas.slice(0, MAX_OS_PARA_PROCESSAR);
    console.log(`Processando ${osAbertas.length} OS(s) abertas com bairro definido (limite: ${MAX_OS_PARA_PROCESSAR})...`);
    
    // Processar cada OS
    for (const os of osAbertas) {
       // Usar diretamente o bairro da OS
       const bairro = os.bairro;
      if (!bairro) {
        continue;
      }
      // Determinar o tipo de serviço com base no id_assunto
      const config = configuracoesAgendamento.find(c => c.id_assunto === os.id_assunto);
      const tipo = config ? config.tipo : 'manutencao';
      let setorId = null;
      try {
        setorId = await openaiService.buscarSetorPorBairro(bairro, listaBairros, tipo);
      } catch (e) {
        console.error(`[ERRO] Falha ao buscar setor para OS ${os.id}:`, e.message);
        continue;
      }
      if (!setorId) {
        continue;
      }

    }
    
    console.log('Processamento de OSs abertas sem setor concluído.');
  } catch (error) {
    console.error('Erro ao processar OSs abertas:', error.message);
  } finally {
    // Fechar a conexão com o MongoDB
    try {
      await mongoose.disconnect();
      console.log('Conexão com MongoDB fechada.');
    } catch (err) {
      console.error('Erro ao fechar conexão com MongoDB:', err.message);
    }
  }
}

/**
 * Inicia o job para atribuir setores às OS
 * @returns {boolean} Indica se o job foi iniciado com sucesso
 */
function iniciarJobAtribuirSetorOS() {
  console.log('Iniciando job de atribuição de setores às OS...');
  
  // Verificar se as variáveis de ambiente necessárias estão configuradas
  if (!process.env.API_TOKEN) {
    console.error('❌ Erro: Token da API IXC não configurado! Configure a variável API_TOKEN no arquivo .env');
    console.log('⚠️ O job de atribuição de setores NÃO será iniciado.');
    return false;
  }
  
  // Verificar se a URL da API está configurada
  if (!process.env.API_URL) {
    console.warn('⚠️ Aviso: URL da API IXC não configurada. Usando URL de demonstração como fallback.');
    console.warn('⚠️ Recomenda-se configurar a variável API_URL no arquivo .env para ambiente de produção.');
    // Continua a execução usando a URL de demo como fallback
  }
  
  // Executar imediatamente ao iniciar
  processarOSAbertas();
  
  // Agendar para executar a cada 30 minutos
  cron.schedule('*/30 * * * *', () => {
    console.log('Executando job agendado de atribuição de setores...');
    processarOSAbertas();
  });
  
  console.log('Job de atribuição de setores às OS iniciado com sucesso.');
  return true;
}

module.exports = {
  iniciarJobAtribuirSetorOS,
  processarOSAbertas
};
