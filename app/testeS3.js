// Teste específico para conexão com AWS S3
const AWS = require('aws-sdk');
const path = require('path');
const dotenv = require('dotenv');

// Carrega as variáveis de ambiente com caminho absoluto
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Extrai e mostra credenciais (parcialmente)
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION;
const bucket = process.env.AWS_S3_BUCKET;

console.log('==== TESTE DE CONEXÃO AWS S3 ====');
console.log(`Access Key ID: ${accessKeyId ? accessKeyId.substring(0, 5) + '...' + accessKeyId.substring(accessKeyId.length - 4) : 'indefinido'}`);
console.log(`Secret Access Key: ${secretAccessKey ? '✅ Definido (primeiros/últimos caracteres: ' + secretAccessKey.substring(0, 3) + '...' + secretAccessKey.substring(secretAccessKey.length - 3) + ')' : '❌ Indefinido'}`);
console.log(`Region: ${region || 'indefinido'}`);
console.log(`Bucket: ${bucket || 'indefinido'}`);

// Configuração do cliente S3
const s3 = new AWS.S3({
  accessKeyId: accessKeyId,
  secretAccessKey: secretAccessKey,
  region: region,
  signatureVersion: 'v4'
});

// Função para testar listagem de buckets (permissão básica)
async function testarListaBuckets() {
  try {
    console.log('\n[TESTE 1] Listando buckets disponíveis...');
    const data = await s3.listBuckets().promise();
    console.log(`✅ Sucesso! Encontrados ${data.Buckets.length} buckets:`);
    data.Buckets.forEach(bucket => {
      console.log(`- ${bucket.Name} (criado em: ${bucket.CreationDate})`);
    });
    return true;
  } catch (err) {
    console.error('❌ Erro ao listar buckets:', err.message);
    console.error('Código:', err.code);
    return false;
  }
}

// Função para testar listagem de objetos no bucket específico
async function testarListaObjetos() {
  if (!bucket) {
    console.error('❌ Bucket não definido. Impossível testar listagem de objetos.');
    return false;
  }

  try {
    console.log(`\n[TESTE 2] Listando objetos no bucket "${bucket}"...`);
    const data = await s3.listObjectsV2({ Bucket: bucket, MaxKeys: 5 }).promise();
    console.log(`✅ Sucesso! Encontrados ${data.Contents.length} objetos (mostrando até 5):`);
    data.Contents.forEach(objeto => {
      console.log(`- ${objeto.Key} (tamanho: ${objeto.Size} bytes)`);
    });
    return true;
  } catch (err) {
    console.error(`❌ Erro ao listar objetos no bucket "${bucket}":`, err.message);
    console.error('Código:', err.code);
    return false;
  }
}

// Executa os testes
async function executarTestes() {
  console.log('\nIniciando testes de conexão com AWS S3...');
  
  const teste1 = await testarListaBuckets();
  const teste2 = await testarListaObjetos();
  
  console.log('\n==== RESULTADO DOS TESTES ====');
  console.log(`Teste 1 (Listar Buckets): ${teste1 ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`Teste 2 (Listar Objetos): ${teste2 ? '✅ PASSOU' : '❌ FALHOU'}`);
  
  if (!teste1 || !teste2) {
    console.log('\n🔍 SUGESTÕES DE SOLUÇÃO:');
    console.log('1. Verifique se as credenciais estão corretas no arquivo .env');
    console.log('2. Confirme se o usuário IAM tem permissões para acessar o S3');
    console.log('3. Verifique se a região está correta');
    console.log('4. Confirme se o bucket realmente existe e está acessível');
  }
}

executarTestes().catch(err => {
  console.error('Erro geral nos testes:', err);
});
