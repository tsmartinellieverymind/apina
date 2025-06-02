/**
 * Script para inicializar a coleção de configurações de setores no MongoDB
 * 
 * Este script cria a coleção 'configuracoes.setores' e insere dados iniciais
 * para mapear bairros aos setores correspondentes.
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Dados iniciais para a coleção de setores
// Estes são exemplos e devem ser substituídos pelos dados reais
const dadosIniciais = [
  {
    bairro: 'Centro',
    id_setor: '1',
    tipoServico: 'instalação',
    criadoEm: new Date(),
    criadoPor: 'sistema'
  },
  {
    bairro: 'Centro',
    id_setor: '2',
    tipoServico: 'manutenção',
    criadoEm: new Date(),
    criadoPor: 'sistema'
  },
  {
    bairro: 'Jardim América',
    id_setor: '3',
    tipoServico: 'instalação',
    criadoEm: new Date(),
    criadoPor: 'sistema'
  },
  {
    bairro: 'Jardim América',
    id_setor: '4',
    tipoServico: 'manutenção',
    criadoEm: new Date(),
    criadoPor: 'sistema'
  }
  // Adicione mais mapeamentos conforme necessário
];

async function inicializarColecaoSetores() {
  try {
    console.log('Conectando ao MongoDB...');
    
    await mongoose.connect(process.env.MONGO_URI, {
      tls: true,
      tlsAllowInvalidCertificates: true
    });
    
    console.log('✅ Conectado ao MongoDB');
    
    const db = mongoose.connection.db;
    
    // Verificar se a coleção já existe
    const colecoes = await db.listCollections({ name: 'configuracoes.setores' }).toArray();
    
    if (colecoes.length > 0) {
      console.log('A coleção configuracoes.setores já existe. Deseja limpar e reinicializar? (S/N)');
      
      // Aqui você pode adicionar lógica para confirmar a reinicialização
      // Para este exemplo, vamos apenas atualizar os documentos existentes
      
      console.log('Atualizando documentos existentes...');
      
      // Buscar documentos existentes
      const setoresCollection = db.collection('configuracoes.setores');
      const documentosExistentes = await setoresCollection.find({}).toArray();
      
      console.log(`Encontrados ${documentosExistentes.length} documentos existentes.`);
      
      // Inserir apenas os novos documentos
      let novosDocumentos = 0;
      
      for (const dado of dadosIniciais) {
        const existente = documentosExistentes.find(doc => 
          doc.bairro === dado.bairro && doc.tipoServico === dado.tipoServico
        );
        
        if (!existente) {
          await setoresCollection.insertOne(dado);
          novosDocumentos++;
        }
      }
      
      console.log(`✅ ${novosDocumentos} novos documentos inseridos.`);
    } else {
      console.log('Criando coleção configuracoes.setores...');
      
      // Criar a coleção e inserir os dados iniciais
      const setoresCollection = db.collection('configuracoes.setores');
      const resultado = await setoresCollection.insertMany(dadosIniciais);
      
      console.log(`✅ Coleção criada com sucesso. ${resultado.insertedCount} documentos inseridos.`);
    }
    
    console.log('Inicialização concluída.');
  } catch (error) {
    console.error('❌ Erro ao inicializar coleção de setores:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Conexão com MongoDB fechada.');
  }
}

// Executar a inicialização
inicializarColecaoSetores();
