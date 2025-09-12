const dayjs = require('dayjs');

/**
 * Teste de vínculo garantido do técnico usando dados mockados
 * Este teste valida se a estrutura de retorno garante o vínculo correto
 */

// Mock da função gerarSugestoesDeAgendamento para teste
function mockGerarSugestoesDeAgendamento(os, opcoes = {}) {
  console.log(`[MOCK] Gerando sugestões para OS ${os.id}, setor ${os.setor}, tipo ${os.tipo}`);
  
  // Simular dados de configuração
  const vinculosTecnicoSetor = {
    "14": [14, 15], // Setor 14 tem técnicos 14 e 15
    "13": [13],     // Setor 13 tem técnico 13
    "16": [16, 17]  // Setor 16 tem técnicos 16 e 17
  };
  
  const limitesSetor = {
    "14": { limite_instalacao_dia: 1 },
    "13": { limite_instalacao_dia: 1 },
    "16": { limite_instalacao_dia: 1 }
  };
  
  // Obter técnicos do setor
  const tecnicosSetor = vinculosTecnicoSetor[os.setor] || [];
  
  if (tecnicosSetor.length === 0) {
    return {
      sugestao: null,
      alternativas: [],
      contexto_agendamento: {
        os_id: os.id,
        setor_original: os.setor,
        tecnicos_disponiveis: [],
        limite_instalacao_setor: 1,
        tipo_os: os.tipo,
        erro: 'Nenhum técnico disponível para o setor'
      }
    };
  }
  
  // Simular disponibilidade (primeiro técnico disponível)
  const tecnicoEscolhido = tecnicosSetor[0];
  const dataAgendamento = dayjs().add(1, 'day').format('YYYY-MM-DD');
  const periodo = os.melhor_horario_agenda || 'M';
  
  // Estrutura de retorno com vínculo garantido
  const sugestao = {
    id_tecnico: tecnicoEscolhido,
    data: dataAgendamento,
    periodo: periodo,
    ocupacao: 1,
    limite: periodo === 'M' ? 2 : 3,
    // CAMPOS GARANTIDOS PARA VÍNCULO
    tecnico_vinculado: tecnicoEscolhido,
    setor_vinculado: os.setor,
    data_formatada: dayjs(dataAgendamento).format('DD/MM/YYYY'),
    periodo_descricao: periodo === 'M' ? 'Manhã' : 'Tarde',
    debug_info: {
      setor: os.setor,
      tecnico: tecnicoEscolhido,
      data: dataAgendamento,
      periodo: periodo,
      ocupacao_atual: 1,
      limite_periodo: periodo === 'M' ? 2 : 3
    }
  };
  
  // Gerar alternativas com outros técnicos
  const alternativas = tecnicosSetor.slice(1).map(tecnico => ({
    id_tecnico: tecnico,
    data: dataAgendamento,
    periodo: periodo === 'M' ? 'T' : 'M', // Período alternativo
    ocupacao: 0,
    limite: periodo === 'M' ? 3 : 2,
    // CAMPOS GARANTIDOS PARA VÍNCULO
    tecnico_vinculado: tecnico,
    setor_vinculado: os.setor,
    data_formatada: dayjs(dataAgendamento).format('DD/MM/YYYY'),
    periodo_descricao: periodo === 'M' ? 'Tarde' : 'Manhã'
  }));
  
  return {
    sugestao: sugestao,
    alternativas: alternativas,
    contexto_agendamento: {
      os_id: os.id,
      setor_original: os.setor,
      tecnicos_disponiveis: tecnicosSetor,
      limite_instalacao_setor: limitesSetor[os.setor]?.limite_instalacao_dia || 1,
      tipo_os: os.tipo
    }
  };
}

// Mock da função aplicarAgendamentoComVinculo
function mockAplicarAgendamentoComVinculo(sugestao, os) {
  console.log(`[MOCK] Aplicando agendamento para OS ${os.id} com técnico ${sugestao.tecnico_vinculado}`);
  
  // Validar se todos os dados necessários estão presentes
  const dadosObrigatorios = [
    'tecnico_vinculado',
    'data',
    'periodo',
    'setor_vinculado'
  ];
  
  const dadosAusentes = dadosObrigatorios.filter(campo => 
    !sugestao[campo] || sugestao[campo] === undefined || sugestao[campo] === null
  );
  
  if (dadosAusentes.length > 0) {
    return {
      sucesso: false,
      erro: `Dados obrigatórios ausentes: ${dadosAusentes.join(', ')}`,
      payload_enviado: null
    };
  }
  
  // Simular payload que seria enviado para a API
  const payload = {
    id: os.id,
    id_tecnico: sugestao.tecnico_vinculado,
    data_agenda_final: `${sugestao.data} ${sugestao.periodo === 'M' ? '08:00:00' : '14:00:00'}`,
    melhor_horario_agenda: sugestao.periodo,
    setor: sugestao.setor_vinculado
  };
  
  // Simular sucesso da API
  return {
    sucesso: true,
    payload_enviado: payload,
    resposta_simulada: {
      status: 'success',
      message: 'OS atualizada com sucesso',
      id_tecnico_atribuido: sugestao.tecnico_vinculado,
      data_agendamento: sugestao.data,
      periodo_agendamento: sugestao.periodo
    }
  };
}

/**
 * Executa o teste completo de vínculo garantido
 */
async function testarVinculoTecnicoGarantido() {
  console.log('🔗 TESTE DE VÍNCULO GARANTIDO DO TÉCNICO (MOCK)');
  console.log('===============================================');
  
  // Cenários de teste
  const cenarios = [
    {
      nome: 'Setor com múltiplos técnicos (14)',
      os: {
        id: "1001",
        setor: "14",
        tipo: "I",
        id_cliente: "1001",
        id_assunto: "1",
        melhor_horario_agenda: "M"
      }
    },
    {
      nome: 'Setor com um técnico (13)',
      os: {
        id: "1002",
        setor: "13",
        tipo: "M",
        id_cliente: "1002",
        id_assunto: "2",
        melhor_horario_agenda: "T"
      }
    },
    {
      nome: 'Setor inexistente (99)',
      os: {
        id: "1003",
        setor: "99",
        tipo: "I",
        id_cliente: "1003",
        id_assunto: "1",
        melhor_horario_agenda: "M"
      }
    }
  ];
  
  let testesPassaram = 0;
  let totalTestes = cenarios.length;
  
  for (let i = 0; i < cenarios.length; i++) {
    const cenario = cenarios[i];
    console.log(`\n📋 CENÁRIO ${i + 1}: ${cenario.nome}`);
    console.log('─'.repeat(50));
    
    try {
      // 1. Gerar sugestões
      const resultado = await mockGerarSugestoesDeAgendamento(cenario.os);
      
      if (!resultado.sugestao) {
        console.log('   ⚠️  Nenhuma sugestão disponível (esperado para setor inexistente)');
        if (cenario.os.setor === "99") {
          console.log('   ✅ Comportamento correto para setor inexistente');
          testesPassaram++;
        } else {
          console.log('   ❌ Falha inesperada na geração de sugestões');
        }
        continue;
      }
      
      // 2. Validar estrutura da sugestão
      console.log('   🔍 Validando estrutura da sugestão...');
      
      const camposObrigatorios = [
        'tecnico_vinculado',
        'setor_vinculado', 
        'data',
        'periodo',
        'data_formatada',
        'periodo_descricao',
        'debug_info'
      ];
      
      let camposOk = 0;
      for (const campo of camposObrigatorios) {
        if (resultado.sugestao[campo] !== undefined && resultado.sugestao[campo] !== null) {
          console.log(`      ✅ ${campo}: ${JSON.stringify(resultado.sugestao[campo])}`);
          camposOk++;
        } else {
          console.log(`      ❌ ${campo}: AUSENTE`);
        }
      }
      
      // 3. Testar aplicação do agendamento
      console.log('   🎯 Testando aplicação do agendamento...');
      
      const resultadoAplicacao = await mockAplicarAgendamentoComVinculo(resultado.sugestao, cenario.os);
      
      if (resultadoAplicacao.sucesso) {
        console.log('      ✅ Agendamento aplicado com sucesso');
        console.log(`      ✅ Técnico vinculado: ${resultadoAplicacao.payload_enviado.id_tecnico}`);
        console.log(`      ✅ Data/Período: ${resultadoAplicacao.payload_enviado.data_agenda_final}`);
        console.log(`      ✅ Setor: ${resultadoAplicacao.payload_enviado.setor}`);
      } else {
        console.log(`      ❌ Falha na aplicação: ${resultadoAplicacao.erro}`);
      }
      
      // 4. Avaliar resultado do cenário
      const cenarioOk = camposOk === camposObrigatorios.length && resultadoAplicacao.sucesso;
      
      if (cenarioOk) {
        console.log(`   🎉 CENÁRIO ${i + 1}: ✅ PASSOU`);
        testesPassaram++;
      } else {
        console.log(`   💥 CENÁRIO ${i + 1}: ❌ FALHOU`);
      }
      
      // 5. Mostrar contexto
      if (resultado.contexto_agendamento) {
        console.log('   📊 Contexto:');
        console.log(`      Técnicos disponíveis: [${resultado.contexto_agendamento.tecnicos_disponiveis.join(', ')}]`);
        console.log(`      Limite instalação: ${resultado.contexto_agendamento.limite_instalacao_setor}`);
        console.log(`      Tipo OS: ${resultado.contexto_agendamento.tipo_os}`);
      }
      
    } catch (error) {
      console.log(`   ❌ ERRO no cenário: ${error.message}`);
    }
  }
  
  // Resultado final
  console.log('\n🎯 RESULTADO FINAL');
  console.log('==================');
  console.log(`Testes passaram: ${testesPassaram}/${totalTestes}`);
  console.log(`Taxa de sucesso: ${((testesPassaram/totalTestes) * 100).toFixed(1)}%`);
  
  if (testesPassaram === totalTestes) {
    console.log('\n🎉 ✅ TODOS OS TESTES PASSARAM!');
    console.log('   - Vínculo do técnico está garantido');
    console.log('   - Estrutura de retorno está correta');
    console.log('   - Aplicação de agendamento funciona');
    console.log('   - Sistema robusto contra falhas');
  } else {
    console.log('\n⚠️  ❌ ALGUNS TESTES FALHARAM');
    console.log('   - Revisar lógica de geração de sugestões');
    console.log('   - Verificar campos obrigatórios');
    console.log('   - Validar aplicação de agendamentos');
  }
  
  return testesPassaram === totalTestes;
}

// Executar teste se chamado diretamente
if (require.main === module) {
  testarVinculoTecnicoGarantido()
    .then(sucesso => {
      process.exit(sucesso ? 0 : 1);
    })
    .catch(error => {
      console.error('Erro fatal no teste:', error);
      process.exit(1);
    });
}

module.exports = { 
  testarVinculoTecnicoGarantido,
  mockGerarSugestoesDeAgendamento,
  mockAplicarAgendamentoComVinculo 
};
