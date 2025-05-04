// Teste de conexão AWS S3 usando SDK v3 (mais recente)
const { S3Client, ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Configuração para ignorar erros de SSL (apenas para teste)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Credenciais
const region = process.env.AWS_REGION || 'us-east-1';
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
};
const bucket = process.env.AWS_S3_BUCKET;

console.log('==== TESTE DE CONEXÃO AWS S3 (SDK v3) ====');
console.log(`Region: ${region}`);
console.log(`Bucket: ${bucket}`);
console.log(`Access Key: ${credentials.accessKeyId ? credentials.accessKeyId.substring(0, 5) + '...' : 'não definido'}`);

// Log detalhado das credenciais antes de usar
console.log('\n[DEBUG] Credenciais lidas do .env:');
console.log(`  Access Key ID: ${credentials.accessKeyId || 'NÃO DEFINIDO'}`);
console.log(`  Secret Access Key: ${credentials.secretAccessKey ? credentials.secretAccessKey.substring(0, 4) + '...' + credentials.secretAccessKey.substring(credentials.secretAccessKey.length - 4) : 'NÃO DEFINIDO'}`);

// Cliente S3
const s3Client = new S3Client({ 
  region,
  credentials,
  forcePathStyle: true // Ajuda em alguns casos
});

// Testa listagem de buckets
async function testarBuckets() {
  try {
    console.log('\n[TESTE 1 - DEBUG] Preparando para listar buckets...');
    const command = new ListBucketsCommand({});
    console.log('[TESTE 1 - DEBUG] Enviando comando ListBuckets...');
    const response = await s3Client.send(command);
    
    console.log(`✅ Sucesso! Encontrados ${response.Buckets.length} buckets:`);
    response.Buckets.forEach(b => console.log(`- ${b.Name}`));
    return true;
  } catch (error) {
    console.error('❌ Erro ao listar buckets:', error.message);
    console.error('[TESTE 1 - DEBUG] Detalhes do erro (ListBuckets):');
    console.dir(error, { depth: null }); // Log completo do erro
    return false;
  }
}

// Testa listagem de objetos
async function testarObjetos() {
  if (!bucket) {
    console.error('❌ Bucket não definido');
    return false;
  }
  
  try {
    console.log(`\n[TESTE 2 - DEBUG] Preparando para listar objetos no bucket "${bucket}"...`);
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      MaxKeys: 5
    });
    console.log('[TESTE 2 - DEBUG] Enviando comando ListObjectsV2...');
    const response = await s3Client.send(command);
    console.log(`✅ Sucesso! Encontrados ${response.Contents?.length || 0} objetos.`);
    if (response.Contents?.length) {
      response.Contents.forEach(obj => console.log(`- ${obj.Key} (${obj.Size} bytes)`));
    }
    return true;
  } catch (error) {
    console.error(`❌ Erro ao listar objetos no bucket "${bucket}":`, error.message);
    console.error(`[TESTE 2 - DEBUG] Detalhes do erro (ListObjectsV2) para o bucket "${bucket}":`);
    console.dir(error, { depth: null }); // Log completo do erro
    return false;
  }
}

// Executa os testes
async function executarTestes() {
  const testeBuckets = await testarBuckets();
  const testeObjetos = await testarObjetos();
  
  console.log('\n==== RESULTADO DOS TESTES ====');
  console.log(`Listar Buckets: ${testeBuckets ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`Listar Objetos: ${testeObjetos ? '✅ PASSOU' : '❌ FALHOU'}`);
  
  if (!testeBuckets || !testeObjetos) {
    console.log('\n🔍 POSSÍVEIS SOLUÇÕES:');
    console.log('1. Verifique se as credenciais estão corretas');
    console.log('2. Confirme se o usuário IAM tem permissões para S3');
    console.log('3. Verifique se há problemas de rede/proxy');
    console.log('4. Tente usar um endpoint S3 específico da região');
  }
}

// Executa
executarTestes().catch(err => {
  console.error('Erro geral:', err);
});
