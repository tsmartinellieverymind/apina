const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Conecta ao MongoDB usando a string de conexão do .env
 * @returns {Promise<boolean>} Sucesso da conexão
 */
async function conectarMongo() {
  try {
    // Remover credenciais da URI para log seguro
    const uriSegura = process.env.MONGO_URI ? 
      process.env.MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '\/\/$1:****@') : 
      'URI não definida';
    
    console.log(`Tentando conectar ao MongoDB: ${uriSegura}`);
    
    // Opções de conexão
    const options = {
      tls: true,
      tlsAllowInvalidCertificates: true,
      serverSelectionTimeoutMS: 5000, // Timeout de 5 segundos
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000
    };
    
    await mongoose.connect(process.env.MONGO_URI, options);
    
    console.log('✅ Conectado ao MongoDB com sucesso!');
    return true;
  } catch (err) {
    console.error('❌ Erro ao conectar no MongoDB:', err);
    
    // Fornecer informações adicionais sobre o erro
    if (err.message && err.message.includes('ENOTFOUND')) {
      console.log('⚠️ Verifique se o endereço do servidor MongoDB está correto.');
    } else if (err.message && err.message.includes('Authentication failed')) {
      console.log('⚠️ Falha na autenticação. Verifique usuário e senha.');
    } else if (err.message && err.message.includes('whitelist')) {
      console.log('⚠️ Seu IP não está na lista de IPs permitidos do MongoDB Atlas.');
      console.log('Acesse https://www.mongodb.com/docs/atlas/security-whitelist/ para adicionar seu IP.');
    }
    
    // Não encerrar o processo, apenas retornar falso
    return false;
  }
}

module.exports = conectarMongo;
