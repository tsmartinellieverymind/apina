// Teste simples de conexão com MongoDB e leitura dos bairros
require('dotenv').config();
const mongoose = require('mongoose');

class MongoTest {
  static async listarBairros() {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        tls: true,
        tlsAllowInvalidCertificates: true
      });
      // Força uso do database correto
      const db = mongoose.connection.useDb('configuracoes');
      const setoresCollection = db.collection('setores');
      const docs = await setoresCollection.find({}).toArray();
      console.log('--- Bairros encontrados na collection configuracoes.setores ---');
      docs.forEach(doc => {
        console.log(`Bairro: ${doc.bairro}`);
        console.log(`Setores: ${JSON.stringify(doc.setores)}`);
        console.log('-----------------------');
      });
      await mongoose.disconnect();
    } catch (err) {
      console.error('Erro ao conectar ou consultar MongoDB:', err);
    }
  }
}

// Executa o teste se chamado diretamente
if (require.main === module) {
  MongoTest.listarBairros();
}

module.exports = MongoTest;
