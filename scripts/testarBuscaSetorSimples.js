/**
 * Script para testar a busca de setores por bairro
 * 
 * Este script permite testar a funcionalidade de busca de setores
 * usando dados do MongoDB ou dados locais como fallback.
 * 
 * Uso: 
 *   node testarBuscaSetorSimples.js [--local] [--verbose]
 * 
 * Opções:
 *   --local: Usa apenas dados locais, sem tentar conectar ao MongoDB
 *   --verbose: Exibe informações detalhadas de debug
 * 
 * Exemplos:
 *   node testarBuscaSetorSimples.js                  # Tenta usar MongoDB, cai para local se falhar
 *   node testarBuscaSetorSimples.js --local          # Usa apenas dados locais
 *   node testarBuscaSetorSimples.js --verbose        # Mostra logs detalhados
 */

require('dotenv').config();
const { OpenAI } = require('openai');
const readline = require('readline');
const mongoose = require('mongoose');

// Configuração do OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configurações padrão
const CONFIG = {
  local: false,    // Usar apenas dados locais
  verbose: false,  // Logs detalhados
  test: false      // Modo de teste automatizado
};

// Processar argumentos da linha de comando
process.argv.forEach(arg => {
  if (arg === '--local') CONFIG.local = true;
  if (arg === '--verbose') CONFIG.verbose = true;
  if (arg === '--test') CONFIG.test = true;
});

// Variável global para armazenar os dados de setores do MongoDB
let SETORES_DADOS = [];

/**
 * Conecta ao MongoDB usando a string de conexão do .env
 * @returns {Promise<boolean>} Sucesso da conexão
 */
async function conectarMongoDB() {
  if (!process.env.MONGO_URI) {
    console.error('❌ Erro: Variável de ambiente MONGO_URI não definida!');
    console.log('Configure a variável MONGO_URI no arquivo .env ou use a flag --local para usar apenas dados locais.');
    return false;
  }

  try {
    console.log('Conectando ao MongoDB...');
    
    // Remover credenciais da URI para log seguro
    const uriSegura = process.env.MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '\/\/$1:****@');
    if (CONFIG.verbose) console.log(`URI de conexão: ${uriSegura}`);
    
    // Opções de conexão simplificadas (removendo opções obsoletas)
    const options = {
      serverSelectionTimeoutMS: 5000, // Timeout de 5 segundos
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000
    };
    
    await mongoose.connect(process.env.MONGO_URI, options);
    
    if (CONFIG.verbose) console.log('✅ Conectado ao MongoDB com sucesso!');
    
    // Carregar dados de setores
    await carregarDadosSetores();
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error.message);
    if (CONFIG.verbose) {
      console.error('Detalhes do erro:', error);
    }
    return false;
  }
}

/**
 * Carrega os dados de setores do MongoDB
 */
async function carregarDadosSetores() {
  try {
    const setoresCollection = mongoose.connection.db.collection('configuracoes.setores');
    SETORES_DADOS = await setoresCollection.find({}).toArray();
    
    console.log(`Carregados ${SETORES_DADOS.length} setores do MongoDB.`);
    
    console.log(`SETORES_DADOS: ${JSON.stringify(SETORES_DADOS)}`);
    
    // Se não houver dados, usar alguns exemplos padrão
    if (SETORES_DADOS.length === 0) {
      console.log('Nenhum setor encontrado no MongoDB. Usando dados de exemplo...');
      carregarDadosExemplo();
    }
    
    return SETORES_DADOS;
  } catch (error) {
    console.error('❌ Erro ao carregar dados de setores:', error.message);
    return [];
  }
}

/**
 * Busca o setor correspondente ao bairro nos dados locais
 * @param {string} bairro - Nome do bairro
 * @param {string} tipoServico - Tipo de serviço (instalação/manutenção)
 * @returns {string|null} - ID do setor ou null se não encontrado
 */
function buscarSetorPorBairro(bairro, tipoServico = 'instalação') {
  try {
    console.log(`Buscando setor para o bairro "${bairro}" (Tipo: ${tipoServico})...`);
    
    // Normalizar bairro e tipo de serviço para comparação
    const bairroNormalizado = bairro.trim().toLowerCase();
    const tipoServicoNormalizado = tipoServico.trim().toLowerCase();
    
    if (CONFIG.verbose) {
      console.log(`Buscando setor para: bairro="${bairroNormalizado}", tipo="${tipoServicoNormalizado}"`);
      console.log(`Total de setores disponíveis: ${SETORES_DADOS.length}`);
    }
    
    // Buscar correspondência exata
    const setorEncontrado = SETORES_DADOS.find(setor => {
      const bairroSetor = setor.bairro.trim().toLowerCase();
      const tipoServicoSetor = setor.tipoServico.trim().toLowerCase();
      
      return bairroSetor === bairroNormalizado && tipoServicoSetor === tipoServicoNormalizado;
    });
    
    if (setorEncontrado) {
      console.log(`✅ Setor encontrado para o bairro "${bairro}": ${setorEncontrado.id_setor}`);
      return setorEncontrado.id_setor;
    }
    
    console.log(`⚠️ Setor não encontrado diretamente. Buscando por similaridade...`);
    return null;
  } catch (error) {
    console.error(`❌ Erro ao buscar setor para o bairro "${bairro}":`, error);
    return null;
  }
}

/**
 * Usa o OpenAI para encontrar o setor mais próximo com base no bairro
 * @param {string} bairro - Nome do bairro
 * @param {string} tipoServico - Tipo de serviço (instalação ou manutenção)
 * @returns {Promise<string|null>} ID do setor ou null se não encontrado
 */
async function findSetorByBairro(bairro, tipoServico) {
  try {
    // Verificar se a API key está configurada
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ Erro: API key do OpenAI não configurada!');
      console.log('Defina a variável de ambiente OPENAI_API_KEY para usar a funcionalidade de IA.');
      return null;
    }

    // Criar uma lista de bairros conhecidos
    const bairrosConhecidos = SETORES_DADOS.map(s => s.bairro);
    const bairrosUnicos = [...new Set(bairrosConhecidos)]; // Remove duplicados
    
    if (bairrosUnicos.length === 0) {
      console.log('⚠️ Nenhum bairro disponível para comparação. Verifique os dados de setores.');
      return null;
    }
    
    console.log(`Buscando correspondência para "${bairro}" entre ${bairrosUnicos.length} bairros conhecidos...`);
    
    // Tentar encontrar uma correspondência sem usar IA primeiro (para bairros com pequenas variações)
    const bairroNormalizado = bairro.trim().toLowerCase();
    
    // Buscar por correspondências parciais
    for (const bairroConhecido of bairrosUnicos) {
      const bairroConhecidoNormalizado = bairroConhecido.trim().toLowerCase();
      
      // Verificar se o bairro fornecido contém o bairro conhecido ou vice-versa
      if (bairroNormalizado.includes(bairroConhecidoNormalizado) || 
          bairroConhecidoNormalizado.includes(bairroNormalizado)) {
        console.log(`🔍 Correspondência parcial encontrada: "${bairroConhecido}"`);
        
        // Buscar o setor correspondente
        const setorEncontrado = SETORES_DADOS.find(s => 
          s.bairro.toLowerCase() === bairroConhecido.toLowerCase() && 
          s.tipoServico === tipoServico
        );
        
        if (setorEncontrado) {
          console.log(`✅ Setor encontrado via correspondência parcial para o bairro "${bairro}" (similar a "${bairroConhecido}"): ${setorEncontrado.id_setor}`);
          global.ultimaCorrespondenciaIA = bairroConhecido;
          return setorEncontrado.id_setor;
        }
      }
    }
    
    // Se não encontrou por correspondência parcial, usar OpenAI
    console.log('Tentando busca avançada com IA...');
    
    // Usar OpenAI para encontrar o bairro mais próximo
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Você é um assistente especializado em encontrar correspondências entre bairros. Sua tarefa é identificar qual bairro da lista é mais similar ao bairro fornecido."
          },
          {
            role: "user",
            content: `Encontre o bairro mais similar a "${bairro}" na seguinte lista: ${JSON.stringify(bairrosUnicos)}. Responda apenas com o nome do bairro mais similar, sem explicações adicionais.`
          }
        ],
        temperature: 0.3,
        max_tokens: 50
      });
      
      const bairroSimilar = completion.choices[0].message.content.trim();
      console.log(`🔍 Bairro similar encontrado via IA: "${bairroSimilar}"`);
      
      // Buscar o setor correspondente ao bairro similar
      const setorEncontrado = SETORES_DADOS.find(s => 
        s.bairro.toLowerCase() === bairroSimilar.toLowerCase() && 
        s.tipoServico === tipoServico
      );
      
      if (setorEncontrado) {
        console.log(`✅ Setor encontrado via IA para o bairro "${bairro}" (similar a "${bairroSimilar}"): ${setorEncontrado.id_setor}`);
        
        // Armazenar o bairro similar para possível salvamento posterior
        global.ultimaCorrespondenciaIA = bairroSimilar;
        
        return setorEncontrado.id_setor;
      }
    } catch (aiError) {
      console.error(`❌ Erro ao conectar com a API do OpenAI: ${aiError.message}`);
      console.log('Continuando com métodos alternativos de busca...');
    }
    
    // Tentar encontrar qualquer setor com nome similar (independente do tipo de serviço)
    // Isso só é executado se a busca com IA falhar ou se não encontrar com o tipo de serviço específico
    for (const setor of SETORES_DADOS) {
      const bairroSetor = setor.bairro.trim().toLowerCase();
      
      // Verificar similaridade básica (contendo parte do nome)
      if (bairroNormalizado.includes(bairroSetor) || bairroSetor.includes(bairroNormalizado)) {
        console.log(`✅ Setor encontrado por similaridade básica para o bairro "${bairro}" (similar a "${setor.bairro}", tipo: ${setor.tipoServico}): ${setor.id_setor}`);
        global.ultimaCorrespondenciaIA = setor.bairro;
        return setor.id_setor;
      }
    }
    
    console.log(`❌ Nenhum setor encontrado para o bairro "${bairro}", mesmo após busca por similaridade.`);
    return null;
  } catch (error) {
    console.error(`❌ Erro ao buscar setor para o bairro "${bairro}":`, error.message);
    if (CONFIG.verbose) {
      console.error('Detalhes do erro:', error);
    }
    return null;
  }
}

/**
 * Cria uma interface de linha de comando interativa
 */
function criarInterfaceInterativa() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return rl;
}

/**
 * Modo interativo para testar múltiplos bairros
 * @param {boolean} usarMongoDB - Se deve tentar usar MongoDB
 */
async function modoInterativo(usarMongoDB = true) {
  // Conectar ao MongoDB primeiro se solicitado
  let conexaoOk = false;
  if (usarMongoDB) {
    conexaoOk = await conectarMongoDB();
    if (!conexaoOk) {
      console.log('❌ Não foi possível conectar ao MongoDB. Usando dados de exemplo.');
      carregarDadosExemplo();
    }
  }
  
  const rl = criarInterfaceInterativa();
  let continuarTestando = true;
  
  console.log('\n🔍 MODO INTERATIVO - TESTE DE BUSCA DE SETORES');
  console.log('Digite "sair" a qualquer momento para encerrar.\n');
  
  while (continuarTestando) {
    const bairro = await new Promise(resolve => {
      rl.question('\nDigite o nome do bairro: ', answer => {
        resolve(answer.trim());
      });
    });
    
    if (bairro.toLowerCase() === 'sair') {
      continuarTestando = false;
      continue;
    }
    
    const tipoServico = await new Promise(resolve => {
      rl.question('Tipo de serviço (instalação/manutenção) [instalação]: ', answer => {
        const tipo = answer.trim().toLowerCase();
        resolve(tipo === '' ? 'instalação' : tipo);
      });
    });
    
    if (tipoServico.toLowerCase() === 'sair') {
      continuarTestando = false;
      continue;
    }
    
    try {
      // Buscar o setor primeiro por correspondência exata
      let setorId = await buscarSetorPorBairro(bairro, tipoServico);
      
      // Se não encontrou por correspondência exata, tentar com IA
      if (!setorId) {
        console.log(`\n🔍 Buscando correspondência via inteligência artificial...`);
        setorId = await findSetorByBairro(bairro, tipoServico);
      }
      
      if (setorId) {
        console.log(`\n✅ RESULTADO: O bairro "${bairro}" corresponde ao setor ID: ${setorId}`);
      } else {
        console.log(`\n❌ RESULTADO: Não foi possível encontrar um setor para o bairro "${bairro}"`);
      }
      
      // Perguntar se deseja salvar a correspondência (se encontrada via IA)
      if (setorId && global.ultimaCorrespondenciaIA) {
        const salvar = await new Promise(resolve => {
          rl.question('\nDeseja salvar esta correspondência no banco de dados? (S/N) [N]: ', answer => {
            resolve(answer.trim().toLowerCase() === 's');
          });
        });
        
        if (salvar) {
          await salvarCorrespondencia(bairro, tipoServico, setorId, global.ultimaCorrespondenciaIA);
        }
        
        // Limpar a flag global
        global.ultimaCorrespondenciaIA = null;
      }
      
      const continuar = await new Promise(resolve => {
        rl.question('\nDeseja testar outro bairro? (S/N) [S]: ', answer => {
          resolve(answer.trim().toLowerCase() !== 'n');
        });
      });
      
      continuarTestando = continuar;
    } catch (error) {
      console.error('❌ Erro ao processar a busca:', error.message);
    }
  }
  
  rl.close();
  console.log('\nTeste finalizado. Obrigado!');
  
  // Fechar conexão com MongoDB
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log('Conexão com MongoDB fechada.');
  }
}

/**
 * Salva uma correspondência de bairro-setor no banco de dados
 */
async function salvarCorrespondencia(bairro, tipoServico, setorId, bairroOriginal) {
  try {
    const setoresCollection = mongoose.connection.db.collection('configuracoes.setores');
    
    await setoresCollection.insertOne({
      bairro: bairro,
      tipoServico: tipoServico,
      id_setor: setorId,
      bairroOriginal: bairroOriginal,
      criadoEm: new Date(),
      criadoPor: 'manual'
    });
    
    console.log(`✅ Correspondência salva com sucesso no MongoDB!`);
    
    // Recarregar dados
    await carregarDadosSetores();
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar correspondência:', error.message);
    return false;
  }
}

/**
 * Carrega os dados de exemplo padrão
 */
function carregarDadosExemplo() {
  console.log('Carregando dados de exemplo...');
  SETORES_DADOS = [
    {
      bairro: 'Centro',
      id_setor: '1',
      tipoServico: 'instalação'
    },
    {
      bairro: 'Centro',
      id_setor: '2',
      tipoServico: 'manutenção'
    },
    {
      bairro: 'Jardim América',
      id_setor: '3',
      tipoServico: 'instalação'
    },
    {
      bairro: 'Jardim América',
      id_setor: '4',
      tipoServico: 'manutenção'
    },
    {
      bairro: 'Vila Nova',
      id_setor: '5',
      tipoServico: 'instalação'
    },
    {
      bairro: 'Vila Nova',
      id_setor: '6',
      tipoServico: 'manutenção'
    },
    {
      bairro: 'Bela Vista',
      id_setor: '7',
      tipoServico: 'instalação'
    },
    {
      bairro: 'Bela Vista',
      id_setor: '8',
      tipoServico: 'manutenção'
    }
  ];
  console.log(`Carregados ${SETORES_DADOS.length} setores de exemplo.`);
  return SETORES_DADOS;
}

/**
 * Função principal
 */
async function main() {
  try {
    // Verificar API Key do OpenAI
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ Variável de ambiente OPENAI_API_KEY não definida!');
      console.log('Defina a variável de ambiente OPENAI_API_KEY para usar a funcionalidade de IA.');
      process.exit(1);
    }
    
    // Inicializar variável global para armazenar a última correspondência encontrada via IA
    global.ultimaCorrespondenciaIA = null;
    
    console.log('ℹ️ Modo de execução:');
    console.log('  • Fonte de dados: ' + (CONFIG.local ? 'Local (dados de exemplo)' : 'MongoDB (com fallback para local)'));
    console.log('  • Logs detalhados: ' + (CONFIG.verbose ? 'Ativados' : 'Desativados'));
    console.log('  • Modo de teste: ' + (CONFIG.test ? 'Ativado' : 'Desativado'));

    if (CONFIG.test) {
      // Modo de teste automatizado
      carregarDadosExemplo();
      await executarTestes();
    } else if (CONFIG.local) {
      console.log('Modo local ativado. Usando apenas dados de exemplo.');
      carregarDadosExemplo();
      await modoInterativo(false);
    } else {
      // Tentar usar MongoDB, com fallback para dados locais
      await modoInterativo(true);
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(0);
  }
}

// Executar o script
main();
