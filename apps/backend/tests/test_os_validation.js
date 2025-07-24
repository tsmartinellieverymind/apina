/**
 * Script de teste para validar as funções de validação de user.osEscolhida
 */

// Simular as funções necessárias
function gerarMensagemOSNaoSelecionada(user, mensagemPersonalizada = null) {
  if (mensagemPersonalizada) {
    return mensagemPersonalizada;
  }
  
  let msg = 'Ops! Parece que ainda não selecionamos uma OS.';
  if (user.osList && user.osList.length > 0) {
    msg += '\n\nOS disponíveis:';
    user.osList.forEach(os => {
      msg += `\n• ${os.id} - ${os.descricaoAssunto || os.titulo || os.mensagem || 'Sem descrição'}`;
    });
    msg += '\n\nPor favor, me informe o número da OS que deseja selecionar.';
  }
  return msg;
}

function validarOSEscolhida(user, respostaObj, mensagemPersonalizada = null) {
  if (!user.osEscolhida) {
    respostaObj.resposta = mensagemPersonalizada || gerarMensagemOSNaoSelecionada(user);
    return false;
  }
  return true;
}

// Casos de teste
console.log('=== TESTE DE VALIDAÇÃO DE user.osEscolhida ===\n');

// Teste 1: Usuário sem OS escolhida e sem lista de OS
console.log('Teste 1: Usuário sem OS escolhida e sem lista de OS');
const user1 = { clienteId: '123', nome: 'João' };
let resposta1 = '';
const respostaObj1 = { 
  get resposta() { return resposta1; }, 
  set resposta(value) { resposta1 = value; } 
};

const resultado1 = validarOSEscolhida(user1, respostaObj1);
console.log('Resultado:', resultado1);
console.log('Resposta:', resposta1);
console.log('---\n');

// Teste 2: Usuário sem OS escolhida mas com lista de OS
console.log('Teste 2: Usuário sem OS escolhida mas com lista de OS');
const user2 = { 
  clienteId: '123', 
  nome: 'João',
  osList: [
    { id: '1001', titulo: 'Instalação de Internet', status: 'A' },
    { id: '1002', descricaoAssunto: 'Reparo de equipamento', status: 'AG' }
  ]
};
let resposta2 = '';
const respostaObj2 = { 
  get resposta() { return resposta2; }, 
  set resposta(value) { resposta2 = value; } 
};

const resultado2 = validarOSEscolhida(user2, respostaObj2);
console.log('Resultado:', resultado2);
console.log('Resposta:', resposta2);
console.log('---\n');

// Teste 3: Usuário sem OS escolhida com mensagem personalizada
console.log('Teste 3: Usuário sem OS escolhida com mensagem personalizada');
const user3 = { clienteId: '123', nome: 'João' };
let resposta3 = '';
const respostaObj3 = { 
  get resposta() { return resposta3; }, 
  set resposta(value) { resposta3 = value; } 
};

const resultado3 = validarOSEscolhida(user3, respostaObj3, 'Por favor, informe qual OS você deseja agendar.');
console.log('Resultado:', resultado3);
console.log('Resposta:', resposta3);
console.log('---\n');

// Teste 4: Usuário com OS escolhida (caso de sucesso)
console.log('Teste 4: Usuário com OS escolhida (caso de sucesso)');
const user4 = { 
  clienteId: '123', 
  nome: 'João',
  osEscolhida: { id: '1001', titulo: 'Instalação de Internet', status: 'A' }
};
let resposta4 = '';
const respostaObj4 = { 
  get resposta() { return resposta4; }, 
  set resposta(value) { resposta4 = value; } 
};

const resultado4 = validarOSEscolhida(user4, respostaObj4);
console.log('Resultado:', resultado4);
console.log('Resposta:', resposta4);
console.log('---\n');

// Teste 5: Verificar se a função não modifica a resposta quando há OS escolhida
console.log('Teste 5: Verificar se a função preserva resposta existente quando há OS');
const user5 = { 
  clienteId: '123', 
  nome: 'João',
  osEscolhida: { id: '1001', titulo: 'Instalação de Internet', status: 'A' }
};
let resposta5 = 'Resposta anterior';
const respostaObj5 = { 
  get resposta() { return resposta5; }, 
  set resposta(value) { resposta5 = value; } 
};

const resultado5 = validarOSEscolhida(user5, respostaObj5);
console.log('Resultado:', resultado5);
console.log('Resposta:', resposta5);
console.log('---\n');

console.log('=== TODOS OS TESTES CONCLUÍDOS ===');
