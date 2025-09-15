const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config();

// Configuração do MongoDB (usando as mesmas configurações do projeto)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'ixc_agendamentos';

// Dados dos arquivos existentes
const vinculosSetoresTecnicos = {
  "4": ["14"],
  "14": ["14", "15"],
  "15": ["14", "15"],
  "16": ["15"],
  "17": ["15", "16"]
};

const limitesInstalacaoPorSetor = {
  "13": { "limite_instalacao_dia": 1 },
  "14": { "limite_instalacao_dia": 1 },
  "15": { "limite_instalacao_dia": 1 },
  "16": { "limite_instalacao_dia": 1 },
  "17": { "limite_instalacao_dia": 1 },
  "18": { "limite_instalacao_dia": 5 },
  "19": { "limite_instalacao_dia": 1 }
};

const configuracoesAgendamento = [
  {
    id_assunto: 0,
    prioridade: 3,
    dataMinimaAgendamentoDias: 1,
    dataMaximaAgendamentoDias: 15,
    tipo: 'manutencao'
  },
  {
    id_assunto: 1,
    prioridade: 3,
    dataMinimaAgendamentoDias: 1,
    dataMaximaAgendamentoDias: 15,
    tipo: 'manutencao'
  },
  {
    id_assunto: 16,
    prioridade: 2,
    dataMinimaAgendamentoDias: 5,
    dataMaximaAgendamentoDias: 20,
    tipo: 'instalacao'
  },
  {
    id_assunto: 17,
    prioridade: 3,
    dataMinimaAgendamentoDias: 3,
    dataMaximaAgendamentoDias: 10,
    tipo: 'instalacao'
  },
  {
    id_assunto: 18,
    prioridade: 1,
    dataMinimaAgendamentoDias: 1,
    dataMaximaAgendamentoDias: 3,
    tipo: 'manutencao'
  },
  {
    id_assunto: 19,
    prioridade: 2,
    dataMinimaAgendamentoDias: 3,
    dataMaximaAgendamentoDias: 10,
    tipo: 'manutencao'
  }
];

async function migrateToMongoDB() {
  let client;
  
  try {
    console.log('🔄 Conectando ao MongoDB...');
    
    console.log(`📍 Usando MongoDB URI: ${MONGO_URI.replace(/\/\/.*@/, '//***:***@')}`);
    
    // Opções de conexão - usar TLS apenas se não for localhost
    const isLocalhost = MONGO_URI.includes('localhost') || MONGO_URI.includes('127.0.0.1');
    const options = isLocalhost ? {} : {
      tls: true,
      tlsAllowInvalidCertificates: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000
    };
    
    client = new MongoClient(MONGO_URI, options);
    await client.connect();
    
    const db = client.db(DB_NAME);
    console.log(`✅ Conectado ao banco de dados: ${DB_NAME}`);

    // 1. Migrar vínculos setores-técnicos
    console.log('\n📋 Migrando vínculos setores-técnicos...');
    const vinculosCollection = db.collection('vinculos_setores_tecnicos');
    
    // Limpar coleção existente
    await vinculosCollection.deleteMany({});
    
    // Converter estrutura para documentos MongoDB
    const vinculosDocuments = Object.entries(vinculosSetoresTecnicos).map(([setor_id, tecnicos_ids]) => ({
      setor_id: parseInt(setor_id),
      tecnicos_ids: tecnicos_ids.map(id => parseInt(id)),
      created_at: new Date(),
      updated_at: new Date()
    }));
    
    await vinculosCollection.insertMany(vinculosDocuments);
    console.log(`✅ Inseridos ${vinculosDocuments.length} vínculos setor-técnico`);

    // 2. Migrar limites de instalação por setor
    console.log('\n📋 Migrando limites de instalação por setor...');
    const limitesCollection = db.collection('limites_instalacao_por_setor');
    
    // Limpar coleção existente
    await limitesCollection.deleteMany({});
    
    // Converter estrutura para documentos MongoDB
    const limitesDocuments = Object.entries(limitesInstalacaoPorSetor).map(([setor_id, config]) => ({
      setor_id: parseInt(setor_id),
      limite_instalacao_dia: config.limite_instalacao_dia,
      created_at: new Date(),
      updated_at: new Date()
    }));
    
    await limitesCollection.insertMany(limitesDocuments);
    console.log(`✅ Inseridos ${limitesDocuments.length} limites de instalação`);

    // 3. Migrar configurações de agendamentos
    console.log('\n📋 Migrando configurações de agendamentos...');
    const configCollection = db.collection('configuracoes_agendamentos');
    
    // Limpar coleção existente
    await configCollection.deleteMany({});
    
    // Adicionar timestamps aos documentos
    const configDocuments = configuracoesAgendamento.map(config => ({
      ...config,
      created_at: new Date(),
      updated_at: new Date()
    }));
    
    await configCollection.insertMany(configDocuments);
    console.log(`✅ Inseridas ${configDocuments.length} configurações de agendamento`);

    // 4. Criar índices para melhor performance
    console.log('\n🔍 Criando índices...');
    
    // Índices para vínculos_setores_tecnicos
    await vinculosCollection.createIndex({ setor_id: 1 }, { unique: true });
    
    // Índices para limites_instalacao_por_setor
    await limitesCollection.createIndex({ setor_id: 1 }, { unique: true });
    
    // Índices para configuracoes_agendamentos
    await configCollection.createIndex({ id_assunto: 1 }, { unique: true });
    await configCollection.createIndex({ tipo: 1 });
    await configCollection.createIndex({ prioridade: 1 });
    
    console.log('✅ Índices criados com sucesso');

    // 5. Verificar dados inseridos
    console.log('\n📊 Verificando dados inseridos...');
    const vinculosCount = await vinculosCollection.countDocuments();
    const limitesCount = await limitesCollection.countDocuments();
    const configCount = await configCollection.countDocuments();
    
    console.log(`📈 Resumo da migração:`);
    console.log(`   • Vínculos setor-técnico: ${vinculosCount} documentos`);
    console.log(`   • Limites de instalação: ${limitesCount} documentos`);
    console.log(`   • Configurações de agendamento: ${configCount} documentos`);

    // 6. Exibir alguns exemplos dos dados inseridos
    console.log('\n🔍 Exemplos dos dados inseridos:');
    
    console.log('\n📋 Vínculos setor-técnico (primeiros 3):');
    const sampleVinculos = await vinculosCollection.find({}).limit(3).toArray();
    sampleVinculos.forEach(doc => {
      console.log(`   Setor ${doc.setor_id}: Técnicos [${doc.tecnicos_ids.join(', ')}]`);
    });
    
    console.log('\n📋 Limites de instalação (primeiros 3):');
    const sampleLimites = await limitesCollection.find({}).limit(3).toArray();
    sampleLimites.forEach(doc => {
      console.log(`   Setor ${doc.setor_id}: ${doc.limite_instalacao_dia} instalações/dia`);
    });
    
    console.log('\n📋 Configurações de agendamento (primeiras 3):');
    const sampleConfigs = await configCollection.find({}).limit(3).toArray();
    sampleConfigs.forEach(doc => {
      console.log(`   Assunto ${doc.id_assunto}: Prioridade ${doc.prioridade}, Tipo: ${doc.tipo}`);
    });

    console.log('\n🎉 Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Conexão com MongoDB fechada');
    }
  }
}

// Executar migração
if (require.main === module) {
  migrateToMongoDB()
    .then(() => {
      console.log('\n✅ Script de migração executado com sucesso!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Falha na execução do script:', error);
      process.exit(1);
    });
}

module.exports = { migrateToMongoDB };
