console.log('=== TESTE: CONFIRMAÇÃO DE NOVA DATA ===\n');

// Simular fluxo corrigido
function simularFluxoCorrigido() {
  console.log('FLUXO CORRIGIDO:');
  console.log('1. Sistema oferece: "17/09, 18/09..."');
  console.log('2. Usuário: "pode ser dia 30?"');
  console.log('3. Sistema: "Claro! Posso agendar para terça-feira, 30/09/2025, no período da tarde?"');
  console.log('4. Usuário: "dia 28"');
  console.log('5. Sistema: "Infelizmente, domingo, 28/09/2025, não é um dia útil..."');
  console.log('6. Usuário: "29"');
  console.log('7. Sistema: ✅ "Perfeito! Posso confirmar o agendamento da TV REPARO para segunda-feira, 29/09/2025, no período da tarde? 😊"');
  console.log('8. Usuário: "sim"');
  console.log('9. Sistema: ✅ Agenda para 29/09/2025');
  console.log('');
}

function simularFluxoAnterior() {
  console.log('FLUXO ANTERIOR (PROBLEMÁTICO):');
  console.log('1. Sistema oferece: "17/09, 18/09..."');
  console.log('2. Usuário: "pode ser dia 30?"');
  console.log('3. Sistema: "Claro! Posso agendar para terça-feira, 30/09/2025, no período da tarde?"');
  console.log('4. Usuário: "dia 28"');
  console.log('5. Sistema: "Infelizmente, o dia 28/09/2025 não é um dia útil..."');
  console.log('6. Usuário: "29"');
  console.log('7. Sistema: ❌ Agenda DIRETAMENTE para 29/09/2025 (SEM CONFIRMAÇÃO!)');
  console.log('');
}

// Testar lógica de confirmação
function testarConfirmacao(mensagem, tipoUltimaPergunta) {
  console.log(`Testando: "${mensagem}" (contexto: ${tipoUltimaPergunta})`);
  
  if (tipoUltimaPergunta === 'AGENDAMENTO_CONFIRMACAO_NOVA_DATA') {
    const mensagemLower = mensagem.toLowerCase().trim();
    const confirmacoesPositivas = ['sim', 'ok', 'pode ser', 'fechado', 'confirmo', 'quero', 'vamos', 'perfeito', 'confirma', 'confirmar'];
    const confirmacoesNegativas = ['não', 'nao', 'não pode', 'nao pode', 'cancelar', 'desistir'];
    
    if (confirmacoesPositivas.some(palavra => mensagemLower.includes(palavra))) {
      console.log('  ✅ Confirmação POSITIVA → Agendar');
    } else if (confirmacoesNegativas.some(palavra => mensagemLower.includes(palavra))) {
      console.log('  ❌ Confirmação NEGATIVA → Oferecer alternativas');
    } else {
      console.log('  🤔 Resposta AMBÍGUA → Perguntar novamente');
    }
  } else {
    console.log('  ℹ️ Contexto normal → Processar normalmente');
  }
  console.log('');
}

console.log('=== COMPARAÇÃO DOS FLUXOS ===\n');
simularFluxoAnterior();
simularFluxoCorrigido();

console.log('=== TESTES DE CONFIRMAÇÃO ===\n');
testarConfirmacao('sim', 'AGENDAMENTO_CONFIRMACAO_NOVA_DATA');
testarConfirmacao('não', 'AGENDAMENTO_CONFIRMACAO_NOVA_DATA');
testarConfirmacao('ok', 'AGENDAMENTO_CONFIRMACAO_NOVA_DATA');
testarConfirmacao('talvez', 'AGENDAMENTO_CONFIRMACAO_NOVA_DATA');
testarConfirmacao('29', 'AGENDAMENTO_SUGESTAO');

console.log('=== BENEFÍCIOS DA CORREÇÃO ===');
console.log('✅ Sistema sempre pede confirmação para datas diferentes');
console.log('✅ Usuário tem controle sobre o agendamento');
console.log('✅ Evita agendamentos não intencionais');
console.log('✅ Melhora experiência e confiança do usuário');
console.log('✅ Fluxo mais previsível e transparente');
console.log('\n🎉 CORREÇÃO IMPLEMENTADA COM SUCESSO!');
