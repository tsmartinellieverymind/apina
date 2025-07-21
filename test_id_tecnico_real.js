const { gerarSugestoesDeAgendamento } = require('./services/ixcService');
const dayjs = require('dayjs');

async function testarIdTecnicoReal() {
  console.log('=== TESTE ID_TECNICO COM DADOS REAIS ===\n');
  
  // Simular uma OS real
  const osSimulada = {
    id: '12345',
    id_assunto: 1, // Assumindo que existe configuração para este assunto
    id_setor: '1',
    status: 'A'
  };
  
  console.log('OS simulada:', osSimulada);
  console.log('');
  
  try {
    // Teste 1: Gerar sugestão geral (sem data específica)
    console.log('1. Gerando sugestão geral...');
    const sugestaoGeral = await gerarSugestoesDeAgendamento(osSimulada);
    
    console.log('Sugestão geral:');
    console.log('- Data:', sugestaoGeral?.sugestao?.data);
    console.log('- Período:', sugestaoGeral?.sugestao?.periodo);
    console.log('- ID Técnico:', sugestaoGeral?.sugestao?.id_tecnico);
    console.log('');
    
    // Teste 2: Gerar sugestão para data específica
    const dataEspecifica = dayjs().add(3, 'day').format('YYYY-MM-DD');
    console.log('2. Gerando sugestão para data específica:', dataEspecifica);
    
    const sugestaoEspecifica = await gerarSugestoesDeAgendamento(osSimulada, {
      dataEspecifica: dataEspecifica,
      periodoEspecifico: 'M'
    });
    
    console.log('Sugestão específica:');
    console.log('- Data:', sugestaoEspecifica?.sugestao?.data);
    console.log('- Período:', sugestaoEspecifica?.sugestao?.periodo);
    console.log('- ID Técnico:', sugestaoEspecifica?.sugestao?.id_tecnico);
    console.log('');
    
    // Teste 3: Verificar se o ID do técnico muda para período diferente
    console.log('3. Gerando sugestão para mesmo dia, período diferente...');
    
    const sugestaoTarde = await gerarSugestoesDeAgendamento(osSimulada, {
      dataEspecifica: dataEspecifica,
      periodoEspecifico: 'T'
    });
    
    console.log('Sugestão para tarde:');
    console.log('- Data:', sugestaoTarde?.sugestao?.data);
    console.log('- Período:', sugestaoTarde?.sugestao?.periodo);
    console.log('- ID Técnico:', sugestaoTarde?.sugestao?.id_tecnico);
    console.log('');
    
    // Análise dos resultados
    console.log('=== ANÁLISE DOS RESULTADOS ===');
    
    if (sugestaoGeral?.sugestao?.id_tecnico) {
      console.log('✅ Sugestão geral retornou ID do técnico');
    } else {
      console.log('❌ Sugestão geral NÃO retornou ID do técnico');
    }
    
    if (sugestaoEspecifica?.sugestao?.id_tecnico) {
      console.log('✅ Sugestão específica retornou ID do técnico');
    } else {
      console.log('❌ Sugestão específica NÃO retornou ID do técnico');
    }
    
    if (sugestaoTarde?.sugestao?.id_tecnico) {
      console.log('✅ Sugestão para tarde retornou ID do técnico');
    } else {
      console.log('❌ Sugestão para tarde NÃO retornou ID do técnico');
    }
    
    // Verificar se os IDs são diferentes (indicando que está funcionando corretamente)
    const idManha = sugestaoEspecifica?.sugestao?.id_tecnico;
    const idTarde = sugestaoTarde?.sugestao?.id_tecnico;
    
    if (idManha && idTarde) {
      if (idManha !== idTarde) {
        console.log('✅ IDs de técnicos são diferentes para manhã/tarde (comportamento esperado)');
      } else {
        console.log('⚠️ IDs de técnicos são iguais para manhã/tarde (pode ser normal se só há um técnico)');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

testarIdTecnicoReal().catch(console.error);
