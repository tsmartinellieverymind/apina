/**
 * Script para testar as validações do webhook após as melhorias
 */

const fs = require('fs');
const path = require('path');

// Ler o arquivo webhook.js
const webhookPath = path.join(__dirname, 'routes', 'webhook.js');
const webhookContent = fs.readFileSync(webhookPath, 'utf8');

console.log('=== ANÁLISE DE VALIDAÇÕES NO WEBHOOK ===\n');

// Verificar se a função validarOSEscolhida foi criada
const hasValidationFunction = webhookContent.includes('function validarOSEscolhida');
console.log('✓ Função validarOSEscolhida criada:', hasValidationFunction);

// Contar quantas vezes a função é usada
const validationUsages = (webhookContent.match(/validarOSEscolhida\(/g) || []).length;
console.log('✓ Número de usos da função validarOSEscolhida:', validationUsages);

// Verificar se ainda há validações inconsistentes
const inconsistentValidations = (webhookContent.match(/if\s*\(\s*!\s*user\.osEscolhida\s*\)\s*\{[^}]*gerarMensagemOSNaoSelecionada/g) || []).length;
console.log('⚠ Validações inconsistentes restantes:', inconsistentValidations);

// Verificar acessos diretos a propriedades sem validação prévia
const lines = webhookContent.split('\n');
const problematicLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNumber = i + 1;
  
  // Procurar por acessos diretos a propriedades de user.osEscolhida
  if (line.includes('user.osEscolhida.') && !line.includes('//')) {
    // Verificar se há validação nas linhas anteriores (últimas 10 linhas)
    let hasValidation = false;
    const startCheck = Math.max(0, i - 10);
    
    for (let j = startCheck; j < i; j++) {
      if (lines[j].includes('validarOSEscolhida') || 
          lines[j].includes('if (!user.osEscolhida)') ||
          lines[j].includes('user.osEscolhida =')) {
        hasValidation = true;
        break;
      }
    }
    
    if (!hasValidation) {
      problematicLines.push({
        line: lineNumber,
        content: line.trim()
      });
    }
  }
}

console.log('\n=== ACESSOS DIRETOS SEM VALIDAÇÃO PRÉVIA ===');
if (problematicLines.length === 0) {
  console.log('✓ Nenhum acesso direto problemático encontrado!');
} else {
  console.log('⚠ Acessos diretos que podem precisar de validação:');
  problematicLines.forEach(item => {
    console.log(`Linha ${item.line}: ${item.content}`);
  });
}

// Verificar intents que manipulam OS
const intentsComOS = [
  'escolher_os',
  'agendar_data', 
  'extrair_data',
  'extrair_hora',
  'alterar_periodo',
  'agendar_outra_data',
  'nova_data',
  'consultar_disponibilidade_data',
  'confirmar_agendamento',
  'detalhes_os',
  'confirmar_escolha_os'
];

console.log('\n=== VERIFICAÇÃO DE INTENTS ===');
intentsComOS.forEach(intent => {
  const intentPattern = new RegExp(`case\\s*'${intent}'\\s*:`);
  const hasIntent = intentPattern.test(webhookContent);
  
  if (hasIntent) {
    // Extrair o bloco do case
    const caseStart = webhookContent.search(intentPattern);
    const nextCasePattern = /case\s*'[^']+'\s*:/g;
    nextCasePattern.lastIndex = caseStart + 1;
    const nextCaseMatch = nextCasePattern.exec(webhookContent);
    
    const caseEnd = nextCaseMatch ? nextCaseMatch.index : webhookContent.indexOf('default:', caseStart);
    const caseBlock = webhookContent.substring(caseStart, caseEnd);
    
    const hasValidation = caseBlock.includes('validarOSEscolhida') || 
                         caseBlock.includes('if (!user.osEscolhida)') ||
                         caseBlock.includes('ensureOSEscolhida');
    
    console.log(`${hasValidation ? '✓' : '⚠'} Intent '${intent}': ${hasValidation ? 'tem validação' : 'pode precisar de validação'}`);
  } else {
    console.log(`- Intent '${intent}': não encontrado`);
  }
});

console.log('\n=== RESUMO ===');
console.log(`✓ Função utilitária criada: ${hasValidationFunction}`);
console.log(`✓ Usos da função: ${validationUsages}`);
console.log(`${inconsistentValidations === 0 ? '✓' : '⚠'} Validações inconsistentes: ${inconsistentValidations}`);
console.log(`${problematicLines.length === 0 ? '✓' : '⚠'} Acessos diretos problemáticos: ${problematicLines.length}`);

if (hasValidationFunction && validationUsages > 0 && inconsistentValidations === 0 && problematicLines.length === 0) {
  console.log('\n🎉 TODAS AS VALIDAÇÕES ESTÃO CORRETAS!');
} else {
  console.log('\n⚠ Algumas melhorias podem ser necessárias.');
}

console.log('\n=== ANÁLISE CONCLUÍDA ===');
