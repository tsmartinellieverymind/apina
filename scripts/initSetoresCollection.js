require('dotenv').config();
const mongoose = require('mongoose');

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
      
      const dadosIniciais = [
        { 
          bairro: 'Centro', 
          ids: {
            instalacao: '1',
            manutencao: '2'
          }
        },
        { 
          bairro: 'Jardim América', 
          ids: {
            instalacao: '3',
            manutencao: '4'
          }
        },
        { 
          bairro: 'Bela Vista', 
          ids: {
            instalacao: '5',
            manutencao: '6'
          }
        },
        { 
          bairro: 'Consolação', 
          ids: {
            instalacao: '7',
            manutencao: '8'
          }
        },
        { 
          bairro: 'Higienópolis', 
          ids: {
            instalacao: '9',
            manutencao: '10'
          }
        },
        { 
          bairro: 'Jardins', 
          ids: {
            instalacao: '11',
            manutencao: '12'
          }
        },
        { 
          bairro: 'Itaim Bibi', 
          ids: {
            instalacao: '13',
            manutencao: '14'
          }
        },
        { 
          bairro: 'Moema', 
          ids: {
            instalacao: '15',
            manutencao: '16'
          }
        },
        { 
          bairro: 'Vila Olímpia', 
          ids: {
            instalacao: '17',
            manutencao: '18'
          }
        },
        { 
          bairro: 'Pinheiros', 
          ids: {
            instalacao: '19',
            manutencao: '20'
          }
        },
      ];

      for (const dado of dadosIniciais) {
        const existente = documentosExistentes.find(doc => 
          doc.bairro === dado.bairro && doc.ids.instalacao === dado.ids.instalacao && doc.ids.manutencao === dado.ids.manutencao
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

      // Definir dados iniciais aqui para evitar referência indefinida
      const dadosIniciaisNovos = [
        { 
          bairro: 'Centro', 
          ids: {
            instalacao: '1',
            manutencao: '2'
          }
        },
        { 
          bairro: 'Jardim América', 
          ids: {
            instalacao: '3',
            manutencao: '4'
          }
        },
        { 
          bairro: 'Bela Vista', 
          ids: {
            instalacao: '5',
            manutencao: '6'
          }
        },
        { 
          bairro: 'Consolação', 
          ids: {
            instalacao: '7',
            manutencao: '8'
          }
        },
        { 
          bairro: 'Higienópolis', 
          ids: {
            instalacao: '9',
            manutencao: '10'
          }
        },
        { 
          bairro: 'Jardins', 
          ids: {
            instalacao: '11',
            manutencao: '12'
          }
        },
        { 
          bairro: 'Itaim Bibi', 
          ids: {
            instalacao: '13',
            manutencao: '14'
          }
        },
        { 
          bairro: 'Moema', 
          ids: {
            instalacao: '15',
            manutencao: '16'
          }
        },
        { 
          bairro: 'Vila Olímpia', 
          ids: {
            instalacao: '17',
            manutencao: '18'
          }
        },
        { 
          bairro: 'Pinheiros', 
          ids: {
            instalacao: '19',
            manutencao: '20'
          }
        },
      ];

      const resultado = await setoresCollection.insertMany(dadosIniciaisNovos);
      
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
