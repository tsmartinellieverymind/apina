/**
 * Script para testar a busca de setores por bairro
 * 
 * Este script permite testar a funcionalidade de busca de setores
 * recebendo um bairro como entrada e retornando o id_setor correspondente.
 * 
 * Uso: 
 * - Modo interativo: node testarBuscaSetor.js
 * - Modo linha de comando: node testarBuscaSetor.js "Nome do Bairro" [tipoServico]
 * 
 * Exemplo: 
 * - node testarBuscaSetor.js "Centro"
 * - node testarBuscaSetor.js "Jardim América" "instalação"
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { OpenAI } = require('openai');
const readline = require('readline');

// Configuração do OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Busca o setor correspondente ao bairro no MongoDB
 * @param {string} bairro - Nome do bairro
 * @param {string} tipoServico - Tipo de serviço (instalação ou manutenção)
 * @returns {Promise<string|null>} ID do setor ou null se não encontrado
 */
async function buscarSetorPorBairro(bairro, tipoServico = 'instalação') {
  try {
    console.log(`Buscando setor para o bairro "${bairro}" (Tipo: ${tipoServico})...`);
    
    // Conectar ao MongoDB se ainda não estiver conectado
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI, {
        tls: true,
        tlsAllowInvalidCertificates: true
      });
      console.log('✅ Conectado ao MongoDB');
    }
    
    // Buscar na coleção de configurações de setores
    const setoresCollection = mongoose.connection.db.collection('configuracoes.setores');
    
    // Primeiro tenta encontrar uma correspondência exata
    let setor = await setoresCollection.findOne({ 
      bairro: { $regex: new RegExp(`^${bairro}$`, 'i') },
      tipoServico: tipoServico
    });
    
    // Se não encontrar, tenta buscar apenas pelo bairro
    if (!setor) {
      setor = await setoresCollection.findOne({ 
        bairro: { $regex: new RegExp(`^${bairro}$`, 'i') }
      });
    }
    
    if (setor) {
      console.log(`✅ Setor encontrado para o bairro "${bairro}": ${setor.id_setor}`);
      return setor.id_setor;
    }
    
    console.log(`⚠️ Setor não encontrado diretamente. Buscando por similaridade...`);
    
    // Se ainda não encontrou, usa o OpenAI para tentar encontrar o melhor match
    console.log(`\n🔍 Buscando correspondência via inteligência artificial...`);
    return await findSetorByBairro(bairro, tipoServico);
  } catch (error) {
    console.error(`❌ Erro ao buscar setor para o bairro ${bairro}:`, error.message);
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
    // Buscar todos os setores disponíveis
    const setoresCollection = mongoose.connection.db.collection('configuracoes.setores');
    const todosSetores = await setoresCollection.find({}).toArray();
    
    if (todosSetores.length === 0) {
      console.log('❌ Nenhum setor encontrado na base de dados.');
      return null;
    }
    
    // Criar uma lista de bairros conhecidos
    const bairrosConhecidos = todosSetores.map(s => s.bairro);
    const bairrosUnicos = [...new Set(bairrosConhecidos)]; // Remove duplicados
    
    console.log(`Buscando correspondência para "${bairro}" entre ${bairrosUnicos.length} bairros conhecidos...`);
    
    // Usar OpenAI para encontrar o bairro mais próximo
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
    console.log(`🔍 Bairro similar encontrado: "${bairroSimilar}"`);
    
    // Buscar o setor correspondente ao bairro similar
    const setorEncontrado = todosSetores.find(s => 
      s.bairro.toLowerCase() === bairroSimilar.toLowerCase() && 
      (!s.tipoServico || s.tipoServico === tipoServico)
    );
    
    if (setorEncontrado) {
      console.log(`✅ Setor encontrado via IA para o bairro "${bairro}" (similar a "${bairroSimilar}"): ${setorEncontrado.id_setor}`);
      
      // Armazenar o bairro similar para possível salvamento posterior
      global.ultimaCorrespondenciaIA = bairroSimilar;
      
      return setorEncontrado.id_setor;
    }
    
    console.log(`❌ Nenhum setor encontrado para o bairro "${bairro}", mesmo após busca por similaridade.`);
    return null;
  } catch (error) {
    console.error(`❌ Erro ao buscar setor via IA para o bairro ${bairro}:`, error.message);
    return null;
  } finally {
    // Não fechamos a conexão aqui para permitir que o script principal faça isso
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
 */
async function modoInterativo() {
  const rl = criarInterfaceInterativa();
  let continuarTestando = true;
  
  // Conectar ao MongoDB uma única vez
  if (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        tls: true,
        tlsAllowInvalidCertificates: true
      });
      console.log('✅ Conectado ao MongoDB');
    } catch (error) {
      console.error('❌ Erro ao conectar ao MongoDB:', error.message);
      rl.close();
      return;
    }
  }
  
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
      // Buscar o setor
      const setorId = await buscarSetorPorBairro(bairro, tipoServico);
      
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
          console.log(`✅ Correspondência salva com sucesso!`);
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
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar correspondência:', error.message);
    return false;
  }
}

/**
 * Função principal
 */
async function main() {
  try {
    // Inicializar variável global para rastrear correspondências via IA
    global.ultimaCorrespondenciaIA = null;
    
    // Verificar se foi fornecido um bairro como argumento
    const bairro = process.argv[2];
    
    if (!bairro) {
      // Modo interativo
      await modoInterativo();
    } else {
      // Modo linha de comando
      const tipoServico = process.argv[3] || 'instalação';
      
      // Conectar ao MongoDB
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGO_URI, {
          tls: true,
          tlsAllowInvalidCertificates: true
        });
        console.log('✅ Conectado ao MongoDB');
      }
      
      // Buscar o setor
      const setorId = await buscarSetorPorBairro(bairro, tipoServico);
      
      if (setorId) {
        console.log(`\n✅ RESULTADO: O bairro "${bairro}" corresponde ao setor ID: ${setorId}`);
      } else {
        console.log(`\n❌ RESULTADO: Não foi possível encontrar um setor para o bairro "${bairro}"`);
      }
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    // Fechar a conexão com o MongoDB
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('Conexão com MongoDB fechada.');
    }
    process.exit(0);
  }
}

// Executar o script
main();
