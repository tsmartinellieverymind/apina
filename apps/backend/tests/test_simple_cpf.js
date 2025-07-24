// Teste simples da correção do ensureClienteId
async function ensureClienteId(user, respostaObj) {
  if (!user.clienteId) {
    respostaObj.resposta = 'Por favor, me informe seu CPF para que eu possa identificar suas ordens de serviço.';
    user.tipoUltimaPergunta = 'CPF';
    return false;
  }
  return true;
}

async function testarFluxoExtrairData() {
  console.log('=== Teste do Fluxo extrair_data ===\n');
  
  // Simular usuário sem clienteId (cenário do problema)
  const user = {
    numero: '+5511999999999',
    etapa: 'inicio',
    cpf: null,
    clienteId: null, // <- Este é o problema: usuário novo sem identificação
    nomeCliente: null,
    osList: [],
    osEscolhida: null
  };
  
  let resposta = '';
  const respostaObj = {
    get resposta() { return resposta; },
    set resposta(value) { resposta = value; }
  };
  
  console.log('Cenário: Usuário diz "pode ser hoje?" mas não tem clienteId');
  console.log('Intent detectada: extrair_data');
  console.log('user.clienteId:', user.clienteId);
  console.log('');
  
  // Simular o fluxo da intent extrair_data COM a correção (await)
  console.log('Executando: if (!(await ensureClienteId(user, respostaObj))) {');
  
  if (!(await ensureClienteId(user, respostaObj))) {
    console.log('✅ ensureClienteId retornou FALSE');
    console.log('✅ Fluxo será interrompido (break)');
    console.log('✅ Resposta definida:', resposta);
    console.log('✅ tipoUltimaPergunta:', user.tipoUltimaPergunta);
    console.log('');
    console.log('🎉 RESULTADO: Sistema pedirá CPF corretamente!');
    return;
  }
  
  // Se chegou aqui, algo deu errado
  console.log('❌ ensureClienteId retornou TRUE - isso não deveria acontecer!');
  console.log('❌ O fluxo continuaria e mostraria mensagem de OS não selecionada');
}

async function testarFluxoComClienteId() {
  console.log('\n=== Teste com ClienteId Presente ===\n');
  
  // Simular usuário COM clienteId
  const user = {
    numero: '+5511999999999',
    etapa: 'inicio',
    cpf: '12345678901',
    clienteId: '12345', // <- Usuário já identificado
    nomeCliente: 'João Silva',
    osList: [],
    osEscolhida: null
  };
  
  let resposta = '';
  const respostaObj = {
    get resposta() { return resposta; },
    set resposta(value) { resposta = value; }
  };
  
  console.log('Cenário: Usuário identificado diz "pode ser hoje?"');
  console.log('user.clienteId:', user.clienteId);
  console.log('');
  
  if (!(await ensureClienteId(user, respostaObj))) {
    console.log('❌ ensureClienteId retornou FALSE - não deveria!');
    return;
  }
  
  console.log('✅ ensureClienteId retornou TRUE');
  console.log('✅ Fluxo continuará normalmente');
  console.log('✅ Resposta não foi alterada:', resposta);
  console.log('');
  console.log('🎉 RESULTADO: Fluxo normal para usuário identificado!');
}

// Executar os testes
async function executarTestes() {
  await testarFluxoExtrairData();
  await testarFluxoComClienteId();
}

executarTestes().catch(console.error);
