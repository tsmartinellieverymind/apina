const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Conecta ao MongoDB usando a string de conexão do .env
 * @returns {Promise<boolean>} Sucesso da conexão
 */
async function conectarMongo() {
  try {
    // Opções de conexão
    const options = {
      tls: true,
      tlsAllowInvalidCertificates: true,
      serverSelectionTimeoutMS: 5000, // Timeout de 5 segundos
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000
    };
    
    await mongoose.connect(process.env.MONGO_URI, options);
    
    return true;
  } catch (err) {
    // Não logar o erro aqui para não poluir o console na inicialização
    // Apenas retornar falso. O erro será tratado por quem chama a função.
    return false;
  }
}

module.exports = conectarMongo;
