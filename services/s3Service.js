const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Desativa verificação de certificado SSL para desenvolvimento
// IMPORTANTE: Remover em produção
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Carrega as variáveis de ambiente com caminho absoluto para garantir
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Debug das variáveis de ambiente
const bucketName = process.env.AWS_S3_BUCKET;
console.log('[S3Service] Inicializando com bucket:', bucketName);

// Configurações iniciais com debug
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION;

console.log('[AWS] Configurando cliente S3:');
console.log(`- Access Key ID: ${accessKeyId ? accessKeyId.substring(0, 5) + '...' : 'indefinido'}`); 
console.log(`- Secret Access Key: ${secretAccessKey ? '✅ Definido (oculto)' : '❌ Indefinido'}`);
console.log(`- Region: ${region || 'indefinido'}`);

// Configuração do cliente S3 com configurações adicionais para resolver problemas de conexão
const s3 = new AWS.S3({
  accessKeyId: accessKeyId,
  secretAccessKey: secretAccessKey,
  region: region,
  signatureVersion: 'v4',
  s3ForcePathStyle: true, // Ajuda em alguns casos de compatibilidade
  httpOptions: {
    timeout: 10000, // 10 segundos de timeout
    agent: false // Desativa o agente HTTP padrão
  }
});

/**
 * Faz upload do arquivo MP3 gerado para o S3 e retorna a URL pública
 * @param {string} filePath Caminho do arquivo local
 * @param {string} key Nome do arquivo no bucket
 * @returns {Promise<string>} URL pública
 */
async function uploadToS3(filePath, key = null) {
  const fileContent = fs.readFileSync(filePath);
  const fileName = key || path.basename(filePath);

  // Usa a variável bucketName que já foi verificada na inicialização
  const params = {
    Bucket: bucketName, // Usa a variável definida no escopo global
    Key: fileName,
    Body: fileContent,
    ContentType: 'audio/mpeg',
  };
  
  if (!params.Bucket) {
    throw new Error('Bucket não definido. Verifique a variável de ambiente AWS_S3_BUCKET');
  }

  console.log('[S3 DEBUG] Bucket carregado:', process.env.AWS_S3_BUCKET);

  await s3.upload(params).promise();

  const url = `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeURIComponent(fileName)}`;
  console.log(`✅ Upload concluído. URL pública: ${url}`);
  return url;
}

module.exports = { uploadToS3 };
