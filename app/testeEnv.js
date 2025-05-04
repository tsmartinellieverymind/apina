// Teste específico para variáveis de ambiente do S3
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

console.log('---- TESTE DE VARIÁVEIS DE AMBIENTE S3 ----');
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✅ Definido' : '❌ Indefinido');
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '✅ Definido' : '❌ Indefinido');
console.log('AWS_REGION:', process.env.AWS_REGION ? '✅ Definido' : '❌ Indefinido');
console.log('AWS_S3_BUCKET:', process.env.AWS_S3_BUCKET);
console.log('Valor exato do bucket (com aspas):', JSON.stringify(process.env.AWS_S3_BUCKET));
console.log('----------------------------------------');
