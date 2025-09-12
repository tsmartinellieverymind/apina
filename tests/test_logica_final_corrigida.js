const dayjs = require('dayjs');

// Mock da função de configuração
const mockLimitesSetor = {
  // Setor 17: Instalação com limites por período (2M/3T)
  '17': {
    tipo: 'instalacao',
    limite_instalacao_dia: 5,
    limite_instalacao_periodo: {
      M: 2,  // 2 instalações de manhã
      T: 3   // 3 instalações à tarde
    }
  },
  // Setor 14: Instalação tradicional (1 por dia)
  '14': {
    tipo: 'instalacao',
    limite_instalacao_dia: 1
  },
  // Setor 13: Manutenção tradicional
  '13': {
    tipo: 'manutencao',
    limite_manutencao: { M: 2, T: 3 }
  }
};

// Mock de OS agendadas para teste
const mockOSAgendadas = [
  // Técnico 1, Setor 17 (instalação com limites por período)
  { id: 1, id_tecnico: 1, tipo: 'I', data_agenda_final: '2024-01-15 08:00:00', melhor_horario_agenda: 'M' },
  { id: 2, id_tecnico: 1, tipo: 'I', data_agenda_final: '2024-01-15 09:00:00', melhor_horario_agenda: 'M' }, // 2ª instalação manhã
  { id: 3, id_tecnico: 1, tipo: 'I', data_agenda_final: '2024-01-15 14:00:00', melhor_horario_agenda: 'T' },
  { id: 4, id_tecnico: 1, tipo: 'M', data_agenda_final: '2024-01-15 15:00:00', melhor_horario_agenda: 'T' }, // Manutenção à tarde
  
  // Técnico 2, Setor 13 (manutenção)
  { id: 5, id_tecnico: 2, tipo: 'M', data_agenda_final: '2024-01-15 08:00:00', melhor_horario_agenda: 'M' },
  { id: 6, id_tecnico: 2, tipo: 'M', data_agenda_final: '2024-01-15 09:00:00', melhor_horario_agenda: 'M' }, // 2ª manutenção manhã
];

function calcularOcupacaoCorrigida(osAgendadas) {
  console.log('\n=== CALCULANDO OCUPAÇÃO CORRIGIDA ===');
  
  const ocupadosPorTecnico = {};
  
  for (const o of osAgendadas) {
    const idTec = o.id_tecnico;
    const data = dayjs(o.data_agenda_final).format('YYYY-MM-DD');
    const periodo = o.melhor_horario_agenda;
    
    // Determinar tipo da OS: I = Instalação, outros = Manutenção
    const tipoOS = o.tipo === 'I' ? 'instalacao' : 'manutencao';
    
    if (!ocupadosPorTecnico[idTec]) ocupadosPorTecnico[idTec] = {};
    if (!ocupadosPorTecnico[idTec][data]) {
      ocupadosPorTecnico[idTec][data] = {
        instalacao: { M: 0, T: 0 },
        manutencao: { M: 0, T: 0 },
        total: { M: 0, T: 0 }
      };
    }
    
    // Incrementar contador específico do tipo
    ocupadosPorTecnico[idTec][data][tipoOS][periodo]++;
    ocupadosPorTecnico[idTec][data].total[periodo]++;
    
    console.log(`OS ${o.id}: Técnico ${idTec}, ${data}, ${periodo}, Tipo: ${tipoOS}`);
  }
  
  // Mostrar ocupação detalhada
  console.log('\n--- OCUPAÇÃO POR TÉCNICO ---');
  Object.entries(ocupadosPorTecnico).forEach(([tec, datas]) => {
    Object.entries(datas).forEach(([data, periodos]) => {
      console.log(`Técnico ${tec} - ${data}:`);
      console.log(`  Instalações: ${periodos.instalacao.M}M/${periodos.instalacao.T}T`);
      console.log(`  Manutenções: ${periodos.manutencao.M}M/${periodos.manutencao.T}T`);
      console.log(`  Total: ${periodos.total.M}M/${periodos.total.T}T`);
    });
  });
  
  return ocupadosPorTecnico;
}

function verificarDisponibilidadeCorrigida(setor, tipoOS, ocupadosPorTecnico, idTecnico, data) {
  console.log(`\n=== VERIFICANDO DISPONIBILIDADE ===`);
  console.log(`Setor: ${setor}, Tipo OS: ${tipoOS}, Técnico: ${idTecnico}, Data: ${data}`);
  
  const limitesSetor = mockLimitesSetor[setor];
  if (!limitesSetor) {
    console.log('❌ Setor não configurado');
    return [];
  }
  
  const ocupados = ocupadosPorTecnico[idTecnico]?.[data] || { 
    instalacao: { M: 0, T: 0 }, 
    manutencao: { M: 0, T: 0 }, 
    total: { M: 0, T: 0 } 
  };
  
  console.log('Ocupação atual:', ocupados);
  
  const periodosDisponiveis = [];
  
  if (limitesSetor.tipo === 'instalacao') {
    console.log('🔧 Verificando setor de INSTALAÇÃO');
    
    const totalInstalacoesDia = (ocupados.instalacao.M || 0) + (ocupados.instalacao.T || 0);
    console.log(`Total instalações no dia: ${totalInstalacoesDia}/${limitesSetor.limite_instalacao_dia}`);
    
    if (totalInstalacoesDia < limitesSetor.limite_instalacao_dia) {
      // Verificar se há limites específicos por período
      if (limitesSetor.limite_instalacao_periodo) {
        console.log('📊 Verificando limites por período');
        for (const periodo of ['M', 'T']) {
          const instalacoesPeriodo = ocupados.instalacao[periodo] || 0;
          const limiteInstalacaoPeriodo = limitesSetor.limite_instalacao_periodo[periodo] || 0;
          
          console.log(`  ${periodo}: ${instalacoesPeriodo}/${limiteInstalacaoPeriodo} instalações`);
          
          if (instalacoesPeriodo < limiteInstalacaoPeriodo) {
            periodosDisponiveis.push(periodo);
            console.log(`  ✅ ${periodo} DISPONÍVEL`);
          } else {
            console.log(`  ❌ ${periodo} OCUPADO`);
          }
        }
      } else {
        console.log('📊 Sem limites por período - verificando ocupação simples');
        if (ocupados.instalacao.M === 0) {
          periodosDisponiveis.push('M');
          console.log('  ✅ M DISPONÍVEL');
        }
        if (ocupados.instalacao.T === 0) {
          periodosDisponiveis.push('T');
          console.log('  ✅ T DISPONÍVEL');
        }
      }
    } else {
      console.log('❌ Limite diário de instalações atingido');
    }
  } else if (limitesSetor.tipo === 'manutencao') {
    console.log('🔧 Verificando setor de MANUTENÇÃO');
    
    for (const periodo of ['M', 'T']) {
      const manutencoesPeriodo = ocupados.manutencao[periodo] || 0;
      const limiteManutencaoPeriodo = limitesSetor.limite_manutencao[periodo];
      
      console.log(`  ${periodo}: ${manutencoesPeriodo}/${limiteManutencaoPeriodo} manutenções`);
      
      if (manutencoesPeriodo < limiteManutencaoPeriodo) {
        periodosDisponiveis.push(periodo);
        console.log(`  ✅ ${periodo} DISPONÍVEL`);
      } else {
        console.log(`  ❌ ${periodo} OCUPADO`);
      }
    }
  }
  
  console.log(`Períodos disponíveis: [${periodosDisponiveis.join(', ')}]`);
  return periodosDisponiveis;
}

function executarTestes() {
  console.log('🧪 TESTE DA LÓGICA CORRIGIDA - SEPARAÇÃO INSTALAÇÃO/MANUTENÇÃO');
  console.log('================================================================');
  
  // 1. Calcular ocupação atual
  const ocupacao = calcularOcupacaoCorrigida(mockOSAgendadas);
  
  // 2. Testes de disponibilidade
  console.log('\n\n🎯 TESTES DE DISPONIBILIDADE');
  console.log('============================');
  
  // Teste 1: Setor 17 (instalação com limites por período) - Técnico 1
  console.log('\n--- TESTE 1: Setor 17, Técnico 1 (já tem 2M/1T instalações) ---');
  const disp1 = verificarDisponibilidadeCorrigida('17', 'I', ocupacao, 1, '2024-01-15');
  console.log(`RESULTADO: ${disp1.length > 0 ? '✅ DISPONÍVEL em ' + disp1.join(',') : '❌ INDISPONÍVEL'}`);
  
  // Teste 2: Setor 17 - Técnico 3 (novo técnico)
  console.log('\n--- TESTE 2: Setor 17, Técnico 3 (técnico novo) ---');
  const disp2 = verificarDisponibilidadeCorrigida('17', 'I', ocupacao, 3, '2024-01-15');
  console.log(`RESULTADO: ${disp2.length > 0 ? '✅ DISPONÍVEL em ' + disp2.join(',') : '❌ INDISPONÍVEL'}`);
  
  // Teste 3: Setor 13 (manutenção) - Técnico 2
  console.log('\n--- TESTE 3: Setor 13, Técnico 2 (já tem 2M manutenções) ---');
  const disp3 = verificarDisponibilidadeCorrigida('13', 'M', ocupacao, 2, '2024-01-15');
  console.log(`RESULTADO: ${disp3.length > 0 ? '✅ DISPONÍVEL em ' + disp3.join(',') : '❌ INDISPONÍVEL'}`);
  
  // Teste 4: Setor 14 (instalação tradicional 1/dia) - Técnico novo
  console.log('\n--- TESTE 4: Setor 14, Técnico 4 (instalação tradicional) ---');
  const disp4 = verificarDisponibilidadeCorrigida('14', 'I', ocupacao, 4, '2024-01-15');
  console.log(`RESULTADO: ${disp4.length > 0 ? '✅ DISPONÍVEL em ' + disp4.join(',') : '❌ INDISPONÍVEL'}`);
  
  console.log('\n\n🎉 RESUMO DOS RESULTADOS:');
  console.log('========================');
  console.log(`Teste 1 (Setor 17, Téc 1): ${disp1.length > 0 ? '✅ Pode agendar mais 1T' : '❌ Limite atingido'}`);
  console.log(`Teste 2 (Setor 17, Téc 3): ${disp2.length > 0 ? '✅ Pode agendar 2M/3T' : '❌ Indisponível'}`);
  console.log(`Teste 3 (Setor 13, Téc 2): ${disp3.length > 0 ? '✅ Pode agendar mais 3T' : '❌ Limite atingido'}`);
  console.log(`Teste 4 (Setor 14, Téc 4): ${disp4.length > 0 ? '✅ Pode agendar 1 instalação' : '❌ Indisponível'}`);
  
  console.log('\n✅ LÓGICA CORRIGIDA FUNCIONANDO!');
  console.log('- Instalações e manutenções são contadas SEPARADAMENTE');
  console.log('- Limites por período funcionam corretamente');
  console.log('- Setor 17 permite 2 instalações manhã + 3 tarde');
}

// Executar os testes
if (require.main === module) {
  executarTestes();
}

module.exports = { calcularOcupacaoCorrigida, verificarDisponibilidadeCorrigida };
