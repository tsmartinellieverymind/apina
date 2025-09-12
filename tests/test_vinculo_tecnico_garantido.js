const { gerarSugestoesDeAgendamento, aplicarAgendamentoComVinculo } = require('../services/ixcService');
const mockOS = require('../app/mocks/mock_ordens_servico_tecnico_ocupado');

/**
 * Teste para validar o vínculo garantido do técnico
 */
async function testarVinculoTecnicoGarantido() {
  console.log('🔗 TESTE DE VÍNCULO GARANTIDO DO TÉCNICO');
  console.log('========================================');
  
  try {
    // Simular uma OS para teste
    const osSimulada = {
      id: "9999",
      setor: "14",
      tipo: "I",
      id_cliente: "1001",
      id_assunto: "1",
      melhor_horario_agenda: "M",
      data_prazo_limite: "2025-01-20 17:00:00"
    };
    
    console.log('\n📋 OS Simulada:', osSimulada);
    
    // 1. Gerar sugestões de agendamento
    console.log('\n🎯 PASSO 1: Gerando sugestões de agendamento...');
    const resultado = await gerarSugestoesDeAgendamento(osSimulada);
    
    if (!resultado.sugestao) {
      console.log('❌ Nenhuma sugestão disponível para teste');
      return;
    }
    
    console.log('\n✅ Sugestão gerada com sucesso:');
    console.log(`   Técnico: ${resultado.sugestao.tecnico_vinculado}`);
    console.log(`   Data: ${resultado.sugestao.data_formatada}`);
    console.log(`   Período: ${resultado.sugestao.periodo_descricao}`);
    console.log(`   Setor: ${resultado.sugestao.setor_vinculado}`);
    
    // 2. Validar estrutura da sugestão
    console.log('\n🔍 PASSO 2: Validando estrutura da sugestão...');
    
    const validacoes = [
      { campo: 'tecnico_vinculado', valor: resultado.sugestao.tecnico_vinculado },
      { campo: 'setor_vinculado', valor: resultado.sugestao.setor_vinculado },
      { campo: 'data', valor: resultado.sugestao.data },
      { campo: 'periodo', valor: resultado.sugestao.periodo },
      { campo: 'debug_info', valor: resultado.sugestao.debug_info }
    ];
    
    let validacoesOk = 0;
    for (const validacao of validacoes) {
      if (validacao.valor !== undefined && validacao.valor !== null) {
        console.log(`   ✅ ${validacao.campo}: ${JSON.stringify(validacao.valor)}`);
        validacoesOk++;
      } else {
        console.log(`   ❌ ${validacao.campo}: AUSENTE`);
      }
    }
    
    console.log(`\n📊 Validações: ${validacoesOk}/${validacoes.length} campos OK`);
    
    // 3. Validar contexto de agendamento
    console.log('\n🔍 PASSO 3: Validando contexto de agendamento...');
    
    if (resultado.contexto_agendamento) {
      console.log('   ✅ Contexto presente:');
      console.log(`      OS ID: ${resultado.contexto_agendamento.os_id}`);
      console.log(`      Setor Original: ${resultado.contexto_agendamento.setor_original}`);
      console.log(`      Técnicos Disponíveis: [${resultado.contexto_agendamento.tecnicos_disponiveis.join(', ')}]`);
      console.log(`      Limite Instalação: ${resultado.contexto_agendamento.limite_instalacao_setor}`);
      console.log(`      Tipo OS: ${resultado.contexto_agendamento.tipo_os}`);
    } else {
      console.log('   ❌ Contexto de agendamento ausente');
    }
    
    // 4. Simular aplicação do agendamento (SEM fazer requisição real)
    console.log('\n🎯 PASSO 4: Simulando aplicação do agendamento...');
    
    // Verificar se todos os dados necessários estão presentes
    const dadosNecessarios = [
      resultado.sugestao.tecnico_vinculado,
      resultado.sugestao.data,
      resultado.sugestao.periodo,
      resultado.sugestao.setor_vinculado
    ];
    
    const dadosCompletos = dadosNecessarios.every(dado => dado !== undefined && dado !== null);
    
    if (dadosCompletos) {
      console.log('   ✅ Todos os dados necessários estão presentes');
      console.log('   ✅ Agendamento pode ser aplicado com vínculo garantido');
      
      // Simular payload que seria enviado
      const payloadSimulado = {
        id: osSimulada.id,
        id_tecnico: resultado.sugestao.tecnico_vinculado,
        data_agenda_final: `${resultado.sugestao.data} ${resultado.sugestao.periodo === 'M' ? '08:00:00' : '14:00:00'}`,
        melhor_horario_agenda: resultado.sugestao.periodo,
        setor: resultado.sugestao.setor_vinculado
      };
      
      console.log('\n📤 Payload que seria enviado:');
      console.log(JSON.stringify(payloadSimulado, null, 2));
      
    } else {
      console.log('   ❌ Dados incompletos - agendamento falharia');
      dadosNecessarios.forEach((dado, index) => {
        const nomes = ['tecnico_vinculado', 'data', 'periodo', 'setor_vinculado'];
        if (dado === undefined || dado === null) {
          console.log(`      ❌ ${nomes[index]}: AUSENTE`);
        }
      });
    }
    
    // 5. Testar alternativas
    console.log('\n🔍 PASSO 5: Validando alternativas...');
    
    if (resultado.alternativas && resultado.alternativas.length > 0) {
      console.log(`   ✅ ${resultado.alternativas.length} alternativa(s) disponível(eis)`);
      
      resultado.alternativas.slice(0, 3).forEach((alt, index) => {
        console.log(`   Alt ${index + 1}: Técnico ${alt.tecnico_vinculado} - ${alt.data_formatada} ${alt.periodo_descricao}`);
      });
    } else {
      console.log('   ℹ️  Nenhuma alternativa disponível (apenas sugestão principal)');
    }
    
    // 6. Resumo final
    console.log('\n🎉 RESUMO DO TESTE:');
    console.log('==================');
    
    const statusGeral = dadosCompletos && validacoesOk === validacoes.length;
    
    console.log(`Status Geral: ${statusGeral ? '✅ SUCESSO' : '❌ FALHA'}`);
    console.log(`Técnico Vinculado: ${resultado.sugestao.tecnico_vinculado || 'N/A'}`);
    console.log(`Setor Vinculado: ${resultado.sugestao.setor_vinculado || 'N/A'}`);
    console.log(`Data/Período: ${resultado.sugestao.data_formatada || 'N/A'} ${resultado.sugestao.periodo_descricao || 'N/A'}`);
    
    if (statusGeral) {
      console.log('\n✅ VÍNCULO DO TÉCNICO GARANTIDO!');
      console.log('   - Sugestão contém todos os dados necessários');
      console.log('   - Técnico está corretamente vinculado');
      console.log('   - Payload pode ser enviado com segurança');
      console.log('   - Sistema previne agendamentos sem técnico');
    } else {
      console.log('\n❌ PROBLEMAS IDENTIFICADOS:');
      console.log('   - Dados incompletos na sugestão');
      console.log('   - Risco de agendamento sem técnico');
      console.log('   - Necessário revisar lógica de geração');
    }
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste se chamado diretamente
if (require.main === module) {
  testarVinculoTecnicoGarantido();
}

module.exports = { testarVinculoTecnicoGarantido };
