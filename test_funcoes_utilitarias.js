// Teste das funções utilitárias
const dayjs = require('dayjs');

/**
 * Formata a descrição de uma OS com fallback para diferentes campos
 * @param {Object} os - Objeto da OS
 * @returns {string} Descrição formatada
 */
function formatarDescricaoOS(os) {
  return os.descricaoAssunto || os.titulo || os.mensagem || 'Sem descrição';
}

/**
 * Formata uma lista de OSs para exibição
 * @param {Array} osList - Lista de OSs 
 * @param {boolean} incluirData - Se deve incluir data de agendamento (para OSs agendadas)
 * @returns {string} Lista formatada
 */
function formatarListaOS(osList, incluirData = false) {
  return osList.map(os => {
    let linha = `• ${os.id} - ${formatarDescricaoOS(os)}`;
    
    if (incluirData && os.data_agenda_final) {
      const dataFormatada = dayjs(os.data_agenda_final).format('DD/MM/YYYY [às] HH:mm');
      linha += ` (agendada para ${dataFormatada})`;
    }
    
    return linha;
  }).join('\n');
}

// Dados de teste
const osExemplo = [
  {
    id: '13508',
    descricaoAssunto: 'Instalação de fibra óptica',
    titulo: 'Título alternativo',
    mensagem: 'Mensagem da OS',
    status: 'A'
  },
  {
    id: '13507',
    titulo: 'Problema na conexão',
    mensagem: 'Detalhes do problema',
    status: 'A'
  },
  {
    id: '13506',
    mensagem: 'Apenas mensagem disponível',
    status: 'A'
  },
  {
    id: '13505',
    status: 'A'
  },
  {
    id: '13314',
    descricaoAssunto: 'Visita técnica agendada',
    status: 'AG',
    data_agenda_final: '2025-07-26T14:00:00.000Z'
  }
];

console.log('🧪 Testando funções utilitárias...\n');

console.log('📋 Teste formatarDescricaoOS:');
osExemplo.forEach(os => {
  console.log(`OS ${os.id}: "${formatarDescricaoOS(os)}"`);
});

console.log('\n📋 Teste formatarListaOS (sem data):');
const osAbertas = osExemplo.filter(os => os.status === 'A');
console.log(formatarListaOS(osAbertas));

console.log('\n📋 Teste formatarListaOS (com data):');
const osAgendadas = osExemplo.filter(os => os.status === 'AG');
console.log(formatarListaOS(osAgendadas, true));

console.log('\n✅ Testes concluídos!');
