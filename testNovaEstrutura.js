/**
 * Script para testar a nova estrutura de vinculos (setores têm técnicos)
 */
const mockOS = require('./app/data/mock_ordens_servico').registros;
const { 
  getTecnicosPorSetor, 
  filtrarTecnicosPorSetor, 
  gerarSugestoesDeAgendamentoV2 
} = require('./services/ixcServiceHelper');

async function testarNovaEstrutura() {
  console.log('===== TESTE DA NOVA ESTRUTURA DE VÍNCULOS =====');
  console.log('(Setores têm técnicos, não técnicos têm setores)');
  console.log('');
  
  // 1. Selecionar uma OS de teste
  const osTeste = mockOS[mockOS.length - 1];
  const setor = String(osTeste.id_setor || osTeste.setor_id || osTeste.setor);
  console.log(`OS Teste ID: ${osTeste.id}, Setor: ${setor}, Assunto: ${osTeste.id_assunto}`);
  
  // 2. Testar obtenção de técnicos por setor
  console.log('\n--- Testando getTecnicosPorSetor ---');
  const tecnicosDoSetor = getTecnicosPorSetor(setor);
  console.log(`Técnicos do setor ${setor}:`, tecnicosDoSetor);
  
  // 3. Testar geração de sugestões com a nova estrutura
  console.log('\n--- Testando gerarSugestoesDeAgendamentoV2 ---');
  try {
    const resultado = await gerarSugestoesDeAgendamentoV2(osTeste);
    
    console.log('\n=== RESUMO DOS RESULTADOS ===');
    console.log(`Sugestão principal: ${resultado.sugestao ? 
      `Data ${resultado.sugestao.data} (${resultado.sugestao.periodo === 'M' ? 'Manhã' : 'Tarde'}) - Técnico ${resultado.sugestao.id_tecnico}` : 
      'Nenhuma sugestão encontrada'}`);
    
    console.log(`Total de alternativas: ${resultado.alternativas.length}`);
    
    // Mostrar algumas alternativas (limitado a 5)
    if (resultado.alternativas.length > 0) {
      console.log('\nAlgumas alternativas disponíveis:');
      resultado.alternativas.slice(0, 5).forEach((alt, idx) => {
        console.log(`${idx + 1}. Data ${alt.data} (${alt.periodo === 'M' ? 'Manhã' : 'Tarde'}) - Técnico ${alt.id_tecnico}`);
      });
    }
    
    return resultado;
  } catch (error) {
    console.error('Erro ao testar a nova estrutura:', error);
    return null;
  }
}

// Executar o teste
testarNovaEstrutura().then(() => {
  console.log('\n===== TESTE FINALIZADO =====');
});
