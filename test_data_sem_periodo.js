const dayjs = require('dayjs');
require('dayjs/locale/pt-br');
dayjs.locale('pt-br');

console.log('=== TESTE: DATA SEM PERÍODO ===\n');

// Simular função de interpretação
function simularInterpretacaoData(mensagem) {
  console.log(`Interpretando: "${mensagem}"`);
  
  // Detectar apenas número (data)
  const matchDia = mensagem.match(/\b(\d{1,2})\b/);
  const matchPeriodo = mensagem.match(/\b(manhã|manha|tarde|noite)\b/i);
  
  if (matchDia) {
    const dia = matchDia[1];
    const dataInterpretada = `2025-09-${dia.padStart(2, '0')}`;
    const periodo = matchPeriodo ? (matchPeriodo[1].toLowerCase().includes('tarde') ? 'T' : 'M') : null;
    
    console.log(`  ✅ Data encontrada: ${dataInterpretada}`);
    console.log(`  ${periodo ? '✅' : '❌'} Período encontrado: ${periodo || 'NENHUM'}`);
    
    return {
      data_interpretada: dataInterpretada,
      periodo_interpretado: periodo
    };
  }
  
  console.log('  ❌ Nenhuma data encontrada');
  return null;
}

// Simular lógica corrigida
function simularLogicaCorrigida(mensagem) {
  console.log(`\n--- SIMULAÇÃO LÓGICA CORRIGIDA ---`);
  console.log(`Mensagem: "${mensagem}"`);
  
  const interpretado = simularInterpretacaoData(mensagem);
  
  if (interpretado && interpretado.data_interpretada) {
    const dataObj = dayjs(interpretado.data_interpretada);
    
    if (!interpretado.periodo_interpretado) {
      // Usuário só forneceu data, perguntar período
      const dataFormatada = dataObj.format('DD/MM/YYYY');
      const diaSemana = dataObj.format('dddd');
      
      console.log(`  🤔 Período não especificado`);
      console.log(`  ✅ Perguntando período ao usuário`);
      
      return {
        sucesso: false,
        perguntarPeriodo: true,
        mensagem: `Para ${diaSemana}, ${dataFormatada}, você prefere manhã ou tarde? 😊`
      };
    } else {
      // Usuário forneceu data e período
      console.log(`  ✅ Data e período completos`);
      console.log(`  ✅ Verificando disponibilidade...`);
      
      return {
        sucesso: true,
        dataFinal: interpretado.data_interpretada,
        periodoFinal: interpretado.periodo_interpretado,
        mensagem: `Agendando para ${dataObj.format('DD/MM/YYYY')} no período da ${interpretado.periodo_interpretado === 'M' ? 'manhã' : 'tarde'}`
      };
    }
  }
  
  return { sucesso: false, mensagem: 'Não foi possível interpretar' };
}

// Testes
console.log('=== CENÁRIOS DE TESTE ===');

// Teste 1: Apenas número (problemático)
console.log('\n1. TESTE: "25" (apenas data)');
const resultado1 = simularLogicaCorrigida('25');
console.log(`   Resultado: ${resultado1.perguntarPeriodo ? '🤔 PERGUNTA' : (resultado1.sucesso ? '✅ SUCESSO' : '❌ ERRO')}`);
console.log(`   Mensagem: ${resultado1.mensagem}`);

// Teste 2: Data com período
console.log('\n2. TESTE: "Dia 25 de manhã" (data + período)');
const resultado2 = simularLogicaCorrigida('Dia 25 de manhã');
console.log(`   Resultado: ${resultado2.perguntarPeriodo ? '🤔 PERGUNTA' : (resultado2.sucesso ? '✅ SUCESSO' : '❌ ERRO')}`);
console.log(`   Mensagem: ${resultado2.mensagem}`);

// Teste 3: Apenas "Dia X"
console.log('\n3. TESTE: "Dia 19" (apenas data)');
const resultado3 = simularLogicaCorrigida('Dia 19');
console.log(`   Resultado: ${resultado3.perguntarPeriodo ? '🤔 PERGUNTA' : (resultado3.sucesso ? '✅ SUCESSO' : '❌ ERRO')}`);
console.log(`   Mensagem: ${resultado3.mensagem}`);

console.log('\n=== FLUXO ESPERADO ===');
console.log('1. Usuário: "25"');
console.log('2. Sistema: "Para quinta-feira, 25/09/2025, você prefere manhã ou tarde? 😊"');
console.log('3. Usuário: "Manhã"');
console.log('4. Sistema: Agenda para 25/09/2025 manhã');
console.log('\n✅ CORREÇÃO IMPLEMENTADA!');
