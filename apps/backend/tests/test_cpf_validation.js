const dayjs = require('dayjs');

// Simular a função ensureClienteId
async function ensureClienteId(user, respostaObj) {
  if (!user.clienteId) {
    // Se não temos o clienteId, precisamos pedir o CPF
    respostaObj.resposta = 'Por favor, me informe seu CPF para que eu possa identificar suas ordens de serviço.';
    user.tipoUltimaPergunta = 'CPF';
    return false;
  }
  return true;
}

// Teste da função
async function testarValidacaoCPF() {
  console.log('=== Teste de Validação de CPF ===\n');
  
  // Cenário 1: Usuário sem clienteId
  console.log('Cenário 1: Usuário sem clienteId');
  const user1 = {
    numero: '+5511999999999',
    etapa: 'inicio',
    cpf: null,
    clienteId: null,
    nomeCliente: null,
    osList: [],
    osEscolhida: null
  };
  
  let resposta1 = '';
  const respostaObj1 = {
    get resposta() { return resposta1; },
    set resposta(value) { resposta1 = value; }
  };
  
  const resultado1 = await ensureClienteId(user1, respostaObj1);
  console.log('Resultado:', resultado1);
  console.log('Resposta:', resposta1);
  console.log('tipoUltimaPergunta:', user1.tipoUltimaPergunta);
  console.log('');
  
  // Cenário 2: Usuário com clienteId
  console.log('Cenário 2: Usuário com clienteId');
  const user2 = {
    numero: '+5511999999999',
    etapa: 'inicio',
    cpf: '12345678901',
    clienteId: '12345',
    nomeCliente: 'João Silva',
    osList: [],
    osEscolhida: null
  };
  
  let resposta2 = '';
  const respostaObj2 = {
    get resposta() { return resposta2; },
    set resposta(value) { resposta2 = value; }
  };
  
  const resultado2 = await ensureClienteId(user2, respostaObj2);
  console.log('Resultado:', resultado2);
  console.log('Resposta:', resposta2);
  console.log('tipoUltimaPergunta:', user2.tipoUltimaPergunta);
  console.log('');
  
  // Cenário 3: Simulação do fluxo de intent extrair_data
  console.log('Cenário 3: Simulação do fluxo de intent extrair_data');
  const user3 = {
    numero: '+5511999999999',
    etapa: 'inicio',
    cpf: null,
    clienteId: null,
    nomeCliente: null,
    osList: [],
    osEscolhida: null
  };
  
  let resposta3 = '';
  const respostaObj3 = {
    get resposta() { return resposta3; },
    set resposta(value) { resposta3 = value; }
  };
  
  console.log('Simulando intent extrair_data...');
  if (!(await ensureClienteId(user3, respostaObj3))) {
    console.log('✅ Validação funcionou! Função retornou false e definiu resposta sobre CPF');
    console.log('Resposta:', resposta3);
    console.log('O fluxo deve parar aqui (break)');
  } else {
    console.log('❌ Erro: Validação não funcionou');
  }
}

// Executar o teste
testarValidacaoCPF().catch(console.error);
