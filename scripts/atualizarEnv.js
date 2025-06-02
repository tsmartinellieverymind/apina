/**
 * Script para atualizar o arquivo .env com a URL da API IXC
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

// Verificar se o arquivo .env existe
if (!fs.existsSync(envPath)) {
  console.error('❌ Arquivo .env não encontrado!');
  process.exit(1);
}

// Ler o conteúdo atual do arquivo .env
let envContent = fs.readFileSync(envPath, 'utf8');

// Verificar se a variável API_URL já existe
if (envContent.includes('API_URL=')) {
  // Atualizar a variável existente
  envContent = envContent.replace(
    /API_URL=.*/g, 
    'API_URL=https://demo.ixcsoft.com.br/webservice/v1'
  );
  console.log('✅ Variável API_URL atualizada no arquivo .env');
} else {
  // Adicionar a variável ao final do arquivo
  envContent += '\n# URL da API do IXC\nAPI_URL=https://demo.ixcsoft.com.br/webservice/v1\n';
  console.log('✅ Variável API_URL adicionada ao arquivo .env');
}

// Salvar as alterações
fs.writeFileSync(envPath, envContent);

console.log('✅ Arquivo .env atualizado com sucesso!');
