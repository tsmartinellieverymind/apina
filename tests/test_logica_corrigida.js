/**
 * Demonstração da lógica CORRIGIDA para limites por tipo de OS
 * Mostra como deveria funcionar a diferenciação entre instalação e manutenção
 */

const dayjs = require('dayjs');

// Exemplo de ocupação CORRIGIDA - separando por tipo
function calcularOcupacaoCorrigida(osAgendadas) {
  const ocupadosPorTecnico = {};
  
  osAgendadas.forEach(os => {
    const idTecnico = os.id_tecnico;
    const dataAgenda = dayjs(os.data_agenda_final || os.data_agenda);
    const dataStr = dataAgenda.format('YYYY-MM-DD');
    const periodo = os.melhor_horario_agenda || 'M';
    const tipoOS = os.tipo === 'I' ? 'instalacao' : 'manutencao'; // I = Instalação
    
    if (!ocupadosPorTecnico[idTecnico]) {
      ocupadosPorTecnico[idTecnico] = {};
    }
    
    if (!ocupadosPorTecnico[idTecnico][dataStr]) {
      ocupadosPorTecnico[idTecnico][dataStr] = {
        instalacao: { M: 0, T: 0 },
        manutencao: { M: 0, T: 0 },
        total: { M: 0, T: 0 }
      };
    }
    
    // Incrementar contador específico do tipo
    ocupadosPorTecnico[idTecnico][dataStr][tipoOS][periodo]++;
    ocupadosPorTecnico[idTecnico][dataStr].total[periodo]++;
  });
  
  return ocupadosPorTecnico;
}

// Lógica CORRIGIDA de verificação de disponibilidade
function verificarDisponibilidadeCorrigida(setor, tecnicoId, data, periodo, ocupadosPorTecnico, tipoOSDesejada, limitesSetor) {
  const dataStr = dayjs(data).format('YYYY-MM-DD');
  const ocupados = ocupadosPorTecnico[tecnicoId]?.[dataStr] || {
    instalacao: { M: 0, T: 0 },
    manutencao: { M: 0, T: 0 },
    total: { M: 0, T: 0 }
  };
  
  console.log(`[DEBUG] Verificação CORRIGIDA:`);
  console.log(`  Setor: ${setor} (${limitesSetor.tipo})`);
  console.log(`  Técnico: ${tecnicoId}, Data: ${dataStr}, Período: ${periodo}`);
  console.log(`  Tipo OS desejada: ${tipoOSDesejada}`);
  console.log(`  Ocupação atual:`, ocupados);
  
  if (limitesSetor.tipo === 'instalacao') {
    // Para setor de instalação: verificar limites específicos de instalação
    
    // 1. Verificar limite total de instalações no dia
    const totalInstalacoesDia = ocupados.instalacao.M + ocupados.instalacao.T;
    if (totalInstalacoesDia >= limitesSetor.limite_instalacao_dia) {
      console.log(`  ❌ Limite diário de instalações atingido: ${totalInstalacoesDia}/${limitesSetor.limite_instalacao_dia}`);
      return false;
    }
    
    // 2. Verificar limite de instalações no período específico
    if (limitesSetor.limite_instalacao_periodo) {
      const instalacoesPeriodo = ocupados.instalacao[periodo];
      const limiteInstalacaoPeriodo = limitesSetor.limite_instalacao_periodo[periodo];
      
      if (instalacoesPeriodo >= limiteInstalacaoPeriodo) {
        console.log(`  ❌ Limite de instalações no período ${periodo} atingido: ${instalacoesPeriodo}/${limiteInstalacaoPeriodo}`);
        return false;
      }
    }
    
    // 3. Verificar se o período ainda tem espaço total (considerando que pode ter manutenções também)
    const limiteTotalPeriodo = limitesSetor.limite_manutencao?.[periodo] || 0;
    if (limiteTotalPeriodo > 0) {
      const totalPeriodo = ocupados.total[periodo];
      if (totalPeriodo >= limiteTotalPeriodo) {
        console.log(`  ❌ Limite total do período ${periodo} atingido: ${totalPeriodo}/${limiteTotalPeriodo}`);
        return false;
      }
    }
    
    console.log(`  ✅ Disponível para instalação no período ${periodo}`);
    return true;
    
  } else if (limitesSetor.tipo === 'manutencao') {
    // Para setor de manutenção: verificar apenas limites de manutenção por período
    const manutencoesPeriodo = ocupados.manutencao[periodo];
    const limiteManutencaoPeriodo = limitesSetor.limite_manutencao[periodo];
    
    if (manutencoesPeriodo >= limiteManutencaoPeriodo) {
      console.log(`  ❌ Limite de manutenções no período ${periodo} atingido: ${manutencoesPeriodo}/${limiteManutencaoPeriodo}`);
      return false;
    }
    
    console.log(`  ✅ Disponível para manutenção no período ${periodo}`);
    return true;
    
  } else if (limitesSetor.tipo === 'misto') {
    // Para setor misto: verificar limites específicos por tipo E limite total
    
    // 1. Verificar limite total do dia
    const totalDia = ocupados.total.M + ocupados.total.T;
    if (totalDia >= limitesSetor.limite_total_dia) {
      console.log(`  ❌ Limite total do dia atingido: ${totalDia}/${limitesSetor.limite_total_dia}`);
      return false;
    }
    
    // 2. Verificar limite específico do tipo desejado
    if (tipoOSDesejada === 'instalacao') {
      const totalInstalacoesDia = ocupados.instalacao.M + ocupados.instalacao.T;
      if (totalInstalacoesDia >= limitesSetor.limite_instalacao_dia) {
        console.log(`  ❌ Limite diário de instalações atingido: ${totalInstalacoesDia}/${limitesSetor.limite_instalacao_dia}`);
        return false;
      }
      
      // Verificar limite de instalações no período
      if (limitesSetor.limite_instalacao_periodo) {
        const instalacoesPeriodo = ocupados.instalacao[periodo];
        const limiteInstalacaoPeriodo = limitesSetor.limite_instalacao_periodo[periodo];
        
        if (instalacoesPeriodo >= limiteInstalacaoPeriodo) {
          console.log(`  ❌ Limite de instalações no período ${periodo} atingido: ${instalacoesPeriodo}/${limiteInstalacaoPeriodo}`);
          return false;
        }
      }
    } else {
      // Para manutenção
      const manutencoesPeriodo = ocupados.manutencao[periodo];
      const limiteManutencaoPeriodo = limitesSetor.limite_manutencao[periodo];
      
      if (manutencoesPeriodo >= limiteManutencaoPeriodo) {
        console.log(`  ❌ Limite de manutenções no período ${periodo} atingido: ${manutencoesPeriodo}/${limiteManutencaoPeriodo}`);
        return false;
      }
    }
    
    console.log(`  ✅ Disponível para ${tipoOSDesejada} no período ${periodo}`);
    return true;
  }
  
  return false;
}

async function demonstrarLogicaCorrigida() {
  console.log('🔧 DEMONSTRAÇÃO DA LÓGICA CORRIGIDA');
  console.log('=' .repeat(60));
  
  // Simular OSs agendadas com tipos diferentes
  const osAgendadas = [
    { id_tecnico: '1', data_agenda: '2025-09-13 08:00:00', melhor_horario_agenda: 'M', tipo: 'I' }, // Instalação manhã
    { id_tecnico: '1', data_agenda: '2025-09-13 14:00:00', melhor_horario_agenda: 'T', tipo: 'M' }, // Manutenção tarde
    { id_tecnico: '1', data_agenda: '2025-09-13 15:00:00', melhor_horario_agenda: 'T', tipo: 'I' }, // Instalação tarde
  ];
  
  const ocupadosCorrigidos = calcularOcupacaoCorrigida(osAgendadas);
  console.log('📊 Ocupação CORRIGIDA por técnico:');
  console.log(JSON.stringify(ocupadosCorrigidos, null, 2));
  
  // Configuração de exemplo: setor que permite 2 instalações manhã, 3 tarde
  const limitesSetor17 = {
    tipo: 'instalacao',
    limite_instalacao_dia: 5,
    limite_instalacao_periodo: {
      M: 2, // 2 instalações de manhã
      T: 3  // 3 instalações à tarde
    },
    limite_manutencao: {
      M: 0,
      T: 0
    }
  };
  
  console.log('\n📋 TESTE: Setor com 2 instalações manhã, 3 tarde');
  console.log('-'.repeat(50));
  
  // Teste 1: Tentar agendar instalação na manhã (já tem 1)
  const disponivel1 = verificarDisponibilidadeCorrigida(
    '17', '1', '2025-09-13', 'M', ocupadosCorrigidos, 'instalacao', limitesSetor17
  );
  console.log(`Resultado: ${disponivel1 ? '✅ DISPONÍVEL' : '❌ INDISPONÍVEL'} (1/2 instalações manhã)`);
  
  // Teste 2: Tentar agendar instalação na tarde (já tem 1)
  const disponivel2 = verificarDisponibilidadeCorrigida(
    '17', '1', '2025-09-13', 'T', ocupadosCorrigidos, 'instalacao', limitesSetor17
  );
  console.log(`Resultado: ${disponivel2 ? '✅ DISPONÍVEL' : '❌ INDISPONÍVEL'} (1/3 instalações tarde)`);
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 CONCLUSÃO: Agora a lógica diferencia corretamente!');
  console.log('   - Conta instalações separadamente de manutenções');
  console.log('   - Permite configurar limites específicos por período');
  console.log('   - Considera limites totais E específicos por tipo');
}

// Executar demonstração
if (require.main === module) {
  demonstrarLogicaCorrigida().catch(console.error);
}

module.exports = { 
  demonstrarLogicaCorrigida,
  calcularOcupacaoCorrigida,
  verificarDisponibilidadeCorrigida
};
