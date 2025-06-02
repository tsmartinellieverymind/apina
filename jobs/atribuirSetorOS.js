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
async function processarOSAbertas() {
  try {
    console.log('Iniciando processamento de OSs abertas sem setor...');
    
    // Buscar OSs abertas sem setor atribuído
    const osAbertas = await buscarOSAbertas();
    
    if (osAbertas.length === 0) {
      console.log('Nenhuma OS para processar.');
      return;
    }
    
    // Processar cada OS
    for (const os of osAbertas) {
      // Buscar detalhes da OS (bairro e tipo de serviço)
      const detalhesOS = await buscarDetalhesOS(os);
      
      if (!detalhesOS) {
        console.error(`Não foi possível obter detalhes da OS ${os.id}. Pulando...`);
        continue;
      }

      const idAssunto = os.id_assunto;
      
      
      // Buscar setor correspondente ao bairro usando a função do ixcService
      const setorId = await openaiService.buscarSetorPorBairro(detalhesOS.bairro, detalhesOS.tipoServico);
      
      if (!setorId) {
        console.error(`Não foi possível determinar o setor para o bairro "${detalhesOS.bairro}". Pulando...`);
        continue;
      }
      
      // Atualizar a OS com o setor determinado
      await atualizarOSComSetor(detalhesOS.osId, setorId);
    }
    
    console.log('Processamento de OSs abertas sem setor concluído.');
  } catch (error) {
    console.error('Erro ao processar OSs abertas:', error.message);
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
