const { gerarSugestoesDeAgendamento } = require('./services/ixcService');
const dayjs = require('dayjs');

// Função para testar os diferentes ranges de data por tipo de serviço
async function testarRangeDataPorTipo() {
  console.log('===== TESTE DE RANGE DE DATAS POR TIPO DE SERVIÇO =====');
  console.log(`Data atual: ${dayjs().format('YYYY-MM-DD')}`);
  
  // Base OS para testes
  const osBase = {
    id: "999",
    tipo: "I",
    status: "A",
    id_cliente: "2002",
    setor: "2",
    data_abertura: dayjs().format('YYYY-MM-DD HH:mm:ss')
  };
  
  // Testar com diferentes id_assunto (tipos de serviço)
  const tiposServico = [
    { id: "1", nome: "Instalação", diasMin: 1, diasMax: 2 },
    { id: "2", nome: "Manutenção", diasMin: 1, diasMax: 5 },
    { id: "3", nome: "Cobrança", diasMin: 1, diasMax: 10 }
  ];
  
  for (const tipo of tiposServico) {
    console.log(`\n----- Testando ${tipo.nome} (id_assunto: ${tipo.id}) -----`);
    console.log(`Configuração esperada: diasMin=${tipo.diasMin}, diasMax=${tipo.diasMax}`);
    
    const os = { ...osBase, id_assunto: tipo.id };
    
    try {
      // Chamar a função com debug para ver os logs detalhados
      await gerarSugestoesDeAgendamento(os, {
        mockDados: true,
        debug: true
      });
    } catch (error) {
      console.error(`Erro ao testar ${tipo.nome}:`, error);
    }
  }
}

// Executar o teste
testarRangeDataPorTipo();
