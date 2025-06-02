/**
 * Script para adicionar o token de API ao arquivo .env
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

// Token para ambiente de demonstração do IXC
const tokenDemo = 'demo.token';

// Verificar se a variável API_TOKEN já existe
if (envContent.includes('API_TOKEN=')) {
  // Atualizar a variável existente
  envContent = envContent.replace(
    /API_TOKEN=.*/g, 
    `API_TOKEN=${tokenDemo}`
  );
  console.log('✅ Variável API_TOKEN atualizada no arquivo .env');
} else {
  // Adicionar a variável ao final do arquivo
  envContent += '\n# Token da API do IXC\nAPI_TOKEN=' + tokenDemo + '\n';
  console.log('✅ Variável API_TOKEN adicionada ao arquivo .env');
}

// Salvar as alterações
fs.writeFileSync(envPath, envContent);

console.log('✅ Arquivo .env atualizado com sucesso!');
