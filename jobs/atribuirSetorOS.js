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
 * @param {Object} os - Objeto da OS
 * @param {string} setorId - ID do setor
 * @returns {Promise<boolean>} Sucesso da atualização
 */
async function atualizarOSComSetor(os, setorId) {
  try {
    // Usando o serviço IXC para atualizar a OS com o setor
    const ok = await ixcService.atualizarOSComSetor(os, setorId);
    return ok;
  } catch (error) {
    console.error(`Erro ao atualizar OS ${os.id} com o setor ${setorId}:`, error.message);
    return false;
  }
}

/**
 * Processa todas as OSs abertas sem setor
 */
// Número máximo de OS a processar por execução (ajuste conforme necessário ou use variável de ambiente)
const MAX_OS_PARA_PROCESSAR = process.env.MAX_OS_PARA_PROCESSAR ? parseInt(process.env.MAX_OS_PARA_PROCESSAR) : 1;

async function processarOSAbertas() {
  try {
    console.log('Iniciando processamento de OSs abertas sem setor...');
    
    // Conectar ao MongoDB para buscar a lista de bairros com seus setores
    await mongoose.connect(process.env.MONGO_URI, {
      tls: true,
      tlsAllowInvalidCertificates: true
    });
    
    // Buscar a lista de bairros com seus setores do banco correto (APENAS UMA VEZ)
    const db = mongoose.connection.useDb('configuracoes');
    const setoresCollection = db.collection('setores');
    const todosSetores = await setoresCollection.find({setores: {$exists: true}}).toArray();
    // if (Array.isArray(todosSetores) && todosSetores.length > 0) {
    //   const nomesBairros = todosSetores.map(b => b.bairro);
    //   console.log('[DEBUG] Bairros encontrados:', nomesBairros.join(', '));
    // }
    console.log(`Encontrados ${todosSetores.length} bairros na coleção de setores.`);
    
    // Carregar configurações de agendamento para determinar o tipo de serviço
    const configuracoesAgendamento = require('../app/data/configuracoes_agendamentos');
    
    // Buscar OSs abertas sem setor atribuído
    let osAbertas = await ixcService.buscarOSAbertaComBairro();
    
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
      const bairro = os.bairro;
      if (!bairro) continue;
      // Determinar o tipo de serviço com base no id_assunto
      const config = configuracoesAgendamento.find(c => String(c.id_assunto) === String(os.id_assunto));
      if (!config) {
        console.warn(`[WARN] Nenhuma configuração encontrada para id_assunto ${os.id_assunto}. Usando fallback 'manutencao'.`);
      }
      const tipoServico = config ? config.tipo : 'manutencao';
      console.log(`[DEBUG] Configuração para id_assunto ${os.id_assunto}:`, config);
      const tipoId = tipoServico === 'instalação' ? 'instalacao' : 'manutencao';
      const listaBairrosFiltrada = todosSetores
        .filter(s => s.setores && s.setores[tipoId])
        .map(s => ({
          bairro: s.bairro,
          instalacao: s.setores.instalacao,
          manutencao: s.setores.manutencao
        }));
      let setorBusca = null;
      try {
        setorBusca = await openaiService.findSetorByBairro(bairro, tipoServico, listaBairrosFiltrada);
      } catch (e) {
        console.error(`[ERRO] Falha ao buscar setor para OS ${os.id}:`, e.message);
        continue;
      }
      // Validar retorno estruturado
      if (!setorBusca || !setorBusca.sucesso_busca || !setorBusca.id) {
        console.error(`[ERRO] Não foi possível encontrar setor válido para o bairro "${bairro}" (OS ${os.id}). Retorno:`, setorBusca);
        continue;
      }
      const setorId = setorBusca.id;
      console.log(`[DEBUG] Setor encontrado para bairro "${bairro}": ${setorId}`);
      try {
        const atualizado = await ixcService.atualizarOSComSetor(os, setorId);
        if (atualizado) {
          console.log(`[INFO] OS ${os.id} atualizada com setor ${setorId}.`);

          // Enviar notificação via WAHA após atualizar a OS, se habilitado
          if (process.env.WAHA_NOTIFY_JOB === 'true') {
            try {
              const { ensureSession, sendText } = require('../services/wahaService');
              const session = process.env.WAHA_SESSION || 'default';
              await ensureSession(session);

              // Tentar obter telefone do .env primeiro; depois, de campos comuns na OS
              const candidato = (process.env.WAHA_TEST_PHONE || os.telefone || os.celular || os.fone || os.fone_celular || os.whatsapp || '').toString();
              const phone = candidato.replace(/\D/g, '');

              if (phone && phone.length >= 10) {
                // Buscar cliente para obter os 3 últimos dígitos do CPF (sem expor o número completo)
                let sufixoCPF = null;
                try {
                  const idCliente = os.id_cliente || os.idCliente || os.cliente_id;
                  if (idCliente) {
                    const resCliente = await ixcService.buscarClientePorId(String(idCliente));
                    const cpfRaw = resCliente?.cliente?.cnpj_cpf || '';
                    const cpfDigits = (cpfRaw.match(/\d/g) || []).join('');
                    if (cpfDigits.length >= 3) sufixoCPF = cpfDigits.slice(-3);
                  }
                } catch (e) {
                  console.warn('[WAHA][JOB] Não foi possível obter sufixo do CPF do cliente:', e?.message || e);
                }

                const nomeCliente = (resCliente?.cliente?.razao || resCliente?.cliente?.nome || '').trim();
                const linhas = [];
                if (nomeCliente) {
                  linhas.push(`Olá, ${nomeCliente}! Sou o assistente da Ibiunet.`);
                } else {
                  linhas.push('Olá! Sou o assistente da Ibiunet.');
                }
                linhas.push('Identificamos que você possui uma ordem de serviço pendente para agendamento.');
                if (sufixoCPF) {
                  linhas.push(`Para sua segurança, o final do seu CPF é ${sufixoCPF}.`);
                }
                linhas.push('Pode me informar o CPF completo para iniciarmos seu atendimento com segurança?');

                const texto = linhas.join('\n\n');
                await sendText({ session, phone, text: texto });
                console.log(`[WAHA][JOB] Mensagem enviada para +${phone} sobre OS ${os.id}.`);
              } else {
                console.log('[WAHA][JOB] Telefone indisponível/ inválido; notificação não enviada.');
              }
            } catch (e) {
              console.error('[WAHA][JOB] Falha ao enviar notificação:', e?.response?.data || e.message || e);
            }
          }
        } else {
          console.error(`[ERRO] Falha ao atualizar OS ${os.id} com setor ${setorId}.`);
        }
      } catch (err) {
        console.error(`[ERRO] Exceção ao atualizar OS ${os.id} com setor ${setorId}:`, err.message);
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
