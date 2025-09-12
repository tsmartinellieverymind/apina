const dayjs = require('dayjs');
const mockOS = require('../app/mocks/mock_ordens_servico_tecnico_ocupado');

function analisarAgendamentosPorTecnico() {
  console.log('📊 ANÁLISE DE AGENDAMENTOS POR TÉCNICO');
  console.log('=====================================');
  
  const osAgendadas = mockOS.registros.filter(o => 
    o.status === 'AG' && 
    o.data_agenda_final && 
    o.id_tecnico
  );
  
  console.log(`\n📋 Total de OS agendadas: ${osAgendadas.length}`);
  
  // Agrupar por técnico
  const agendamentosPorTecnico = {};
  
  for (const os of osAgendadas) {
    const idTecnico = os.id_tecnico;
    const data = dayjs(os.data_agenda_final).format('YYYY-MM-DD');
    const periodo = os.melhor_horario_agenda || (dayjs(os.data_agenda_final).hour() < 12 ? 'M' : 'T');
    const tipo = os.tipo === 'I' ? 'Instalação' : (os.tipo === 'M' ? 'Manutenção' : 'Suporte');
    const setor = os.setor;
    
    if (!agendamentosPorTecnico[idTecnico]) {
      agendamentosPorTecnico[idTecnico] = {
        total: 0,
        porData: {},
        porTipo: { Instalação: 0, Manutenção: 0, Suporte: 0 },
        porSetor: {},
        porPeriodo: { M: 0, T: 0 }
      };
    }
    
    const tecnico = agendamentosPorTecnico[idTecnico];
    tecnico.total++;
    tecnico.porTipo[tipo]++;
    tecnico.porPeriodo[periodo]++;
    
    // Por setor
    if (!tecnico.porSetor[setor]) tecnico.porSetor[setor] = 0;
    tecnico.porSetor[setor]++;
    
    // Por data
    if (!tecnico.porData[data]) {
      tecnico.porData[data] = {
        total: 0,
        instalacao: { M: 0, T: 0 },
        manutencao: { M: 0, T: 0 },
        suporte: { M: 0, T: 0 },
        periodos: { M: 0, T: 0 }
      };
    }
    
    const dataInfo = tecnico.porData[data];
    dataInfo.total++;
    dataInfo.periodos[periodo]++;
    
    if (tipo === 'Instalação') {
      dataInfo.instalacao[periodo]++;
    } else if (tipo === 'Manutenção') {
      dataInfo.manutencao[periodo]++;
    } else {
      dataInfo.suporte[periodo]++;
    }
  }
  
  // Exibir resultados
  console.log('\n👥 RESUMO POR TÉCNICO:');
  console.log('=====================');
  
  const tecnicos = Object.keys(agendamentosPorTecnico).sort((a, b) => parseInt(a) - parseInt(b));
  
  for (const idTecnico of tecnicos) {
    const tecnico = agendamentosPorTecnico[idTecnico];
    
    console.log(`\n🔧 TÉCNICO ${idTecnico}:`);
    console.log(`   Total de agendamentos: ${tecnico.total}`);
    console.log(`   Por período: ${tecnico.porPeriodo.M}M / ${tecnico.porPeriodo.T}T`);
    console.log(`   Por tipo: ${tecnico.porTipo.Instalação}I / ${tecnico.porTipo.Manutenção}M / ${tecnico.porTipo.Suporte}S`);
    
    // Setores
    const setores = Object.keys(tecnico.porSetor).sort();
    console.log(`   Setores: ${setores.map(s => `${s}(${tecnico.porSetor[s]})`).join(', ')}`);
    
    // Detalhes por data
    console.log('   📅 Por data:');
    const datas = Object.keys(tecnico.porData).sort();
    for (const data of datas) {
      const dataInfo = tecnico.porData[data];
      const dataFormatada = dayjs(data).format('DD/MM (ddd)');
      
      console.log(`      ${dataFormatada}: ${dataInfo.total} total (${dataInfo.periodos.M}M/${dataInfo.periodos.T}T)`);
      console.log(`         Instalações: ${dataInfo.instalacao.M}M/${dataInfo.instalacao.T}T`);
      console.log(`         Manutenções: ${dataInfo.manutencao.M}M/${dataInfo.manutencao.T}T`);
      console.log(`         Suporte: ${dataInfo.suporte.M}M/${dataInfo.suporte.T}T`);
    }
  }
  
  // Estatísticas gerais
  console.log('\n📈 ESTATÍSTICAS GERAIS:');
  console.log('=======================');
  
  const totalTecnicos = tecnicos.length;
  const totalAgendamentos = Object.values(agendamentosPorTecnico).reduce((sum, t) => sum + t.total, 0);
  const mediaPorTecnico = (totalAgendamentos / totalTecnicos).toFixed(1);
  
  console.log(`Total de técnicos: ${totalTecnicos}`);
  console.log(`Total de agendamentos: ${totalAgendamentos}`);
  console.log(`Média por técnico: ${mediaPorTecnico}`);
  
  // Análise de ocupação
  console.log('\n🎯 ANÁLISE DE OCUPAÇÃO:');
  console.log('=======================');
  
  for (const idTecnico of tecnicos) {
    const tecnico = agendamentosPorTecnico[idTecnico];
    const datas = Object.keys(tecnico.porData);
    
    console.log(`\n🔧 TÉCNICO ${idTecnico}:`);
    
    for (const data of datas.sort()) {
      const dataInfo = tecnico.porData[data];
      const dataFormatada = dayjs(data).format('DD/MM (ddd)');
      
      // Verificar se está no limite (2M/3T = 5 total)
      const ocupacaoManha = dataInfo.periodos.M;
      const ocupacaoTarde = dataInfo.periodos.T;
      const limiteManha = 2;
      const limiteTarde = 3;
      
      const statusManha = ocupacaoManha >= limiteManha ? '🔴 LOTADO' : `🟢 ${limiteManha - ocupacaoManha} livre(s)`;
      const statusTarde = ocupacaoTarde >= limiteTarde ? '🔴 LOTADO' : `🟢 ${limiteTarde - ocupacaoTarde} livre(s)`;
      
      console.log(`   ${dataFormatada}:`);
      console.log(`      Manhã: ${ocupacaoManha}/${limiteManha} ${statusManha}`);
      console.log(`      Tarde: ${ocupacaoTarde}/${limiteTarde} ${statusTarde}`);
      
      // Análise de instalações por dia
      const totalInstalacoesDia = dataInfo.instalacao.M + dataInfo.instalacao.T;
      if (totalInstalacoesDia > 1) {
        console.log(`      ⚠️  ATENÇÃO: ${totalInstalacoesDia} instalações no mesmo dia!`);
      }
    }
  }
  
  // Verificar violações de regras
  console.log('\n⚠️  VERIFICAÇÃO DE REGRAS:');
  console.log('==========================');
  
  let violacoes = 0;
  
  for (const idTecnico of tecnicos) {
    const tecnico = agendamentosPorTecnico[idTecnico];
    
    for (const [data, dataInfo] of Object.entries(tecnico.porData)) {
      const dataFormatada = dayjs(data).format('DD/MM');
      
      // Regra 1: Máximo 2M/3T por dia
      if (dataInfo.periodos.M > 2) {
        console.log(`❌ Técnico ${idTecnico} - ${dataFormatada}: ${dataInfo.periodos.M} agendamentos manhã (máximo 2)`);
        violacoes++;
      }
      
      if (dataInfo.periodos.T > 3) {
        console.log(`❌ Técnico ${idTecnico} - ${dataFormatada}: ${dataInfo.periodos.T} agendamentos tarde (máximo 3)`);
        violacoes++;
      }
      
      // Regra 2: Máximo 1 instalação por dia (regra geral)
      const totalInstalacoes = dataInfo.instalacao.M + dataInfo.instalacao.T;
      if (totalInstalacoes > 1) {
        console.log(`⚠️  Técnico ${idTecnico} - ${dataFormatada}: ${totalInstalacoes} instalações (regra geral: máximo 1)`);
      }
    }
  }
  
  if (violacoes === 0) {
    console.log('✅ Nenhuma violação de limite encontrada!');
  } else {
    console.log(`❌ ${violacoes} violação(ões) de limite encontrada(s)!`);
  }
  
  return agendamentosPorTecnico;
}

// Executar análise
if (require.main === module) {
  analisarAgendamentosPorTecnico();
}

module.exports = { analisarAgendamentosPorTecnico };
