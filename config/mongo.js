const mongoose = require('mongoose');
require('dotenv').config();

async function conectarMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      tls: true,
      tlsAllowInvalidCertificates: true
    });

    console.log('✅ Conectado ao MongoDB');
  } catch (err) {
    console.error('❌ Erro ao conectar no MongoDB:', err);
    process.exit(1);
  }
}

module.exports = conectarMongo;
