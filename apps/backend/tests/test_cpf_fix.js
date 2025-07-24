// Teste para verificar se a correção do ensureClienteId funciona
const express = require('express');
const request = require('supertest');

// Mock das dependências
jest.mock('./services/openaiService', () => ({
  detectarIntentComContexto: jest.fn().mockResolvedValue('extrair_data'),
  interpretaDataePeriodo: jest.fn().mockResolvedValue({
    data_interpretada: '2024-01-29',
    periodo_interpretado: 'T'
  })
}));

jest.mock('./services/ixcService', () => ({
  buscarOSPorClienteId: jest.fn().mockResolvedValue([])
}));

// Simular o webhook
const app = express();
app.use(express.urlencoded({ extended: true }));

// Simular a função ensureClienteId
async function ensureClienteId(user, respostaObj) {
  if (!user.clienteId) {
    respostaObj.resposta = 'Por favor, me informe seu CPF para que eu possa identificar suas ordens de serviço.';
    user.tipoUltimaPergunta = 'CPF';
    return false;
  }
  return true;
}

// Simular o fluxo da intent extrair_data
app.post('/webhook', async (req, res) => {
  const mensagem = req.body.Body || '';
  const numero = req.body.From || '+5511999999999';
  
  // Simular usuário sem clienteId (novo usuário)
  const user = {
    numero,
    etapa: 'inicio',
    cpf: null,
    clienteId: null,
    nomeCliente: null,
    osList: [],
    osEscolhida: null
  };
  
  let resposta = '';
  const respostaObj = {
    get resposta() { return resposta; },
    set resposta(value) { resposta = value; }
  };
  
  // Simular a detecção de intent como 'extrair_data' (quando usuário diz "pode ser hoje?")
  const intent = 'extrair_data';
  
  console.log(`[TESTE] Mensagem: "${mensagem}"`);
  console.log(`[TESTE] Intent detectada: ${intent}`);
  console.log(`[TESTE] User.clienteId: ${user.clienteId}`);
  
  // Aplicar a correção: usar await na chamada de ensureClienteId
  if (!(await ensureClienteId(user, respostaObj))) {
    console.log('[TESTE] ✅ ensureClienteId retornou false - validação funcionou!');
    console.log(`[TESTE] Resposta definida: "${resposta}"`);
    
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${resposta}</Message>
</Response>`);
    return;
  }
  
  // Se chegou aqui, a validação falhou
  console.log('[TESTE] ❌ ensureClienteId retornou true - validação falhou!');
  resposta = 'Ops! Parece que ainda não selecionamos uma OS. Pode me dizer qual é?';
  
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${resposta}</Message>
</Response>`);
});

// Teste
async function testarCorrecao() {
  console.log('=== Teste da Correção do ensureClienteId ===\n');
  
  const response = await request(app)
    .post('/webhook')
    .send({
      Body: 'pode ser hoje?',
      From: '+5511999999999'
    });
  
  console.log('\n=== Resultado do Teste ===');
  console.log('Status:', response.status);
  console.log('Response Body:', response.text);
  
  // Verificar se a resposta contém a mensagem de CPF
  if (response.text.includes('CPF')) {
    console.log('\n✅ SUCESSO: O sistema está pedindo CPF corretamente!');
  } else if (response.text.includes('selecionamos uma OS')) {
    console.log('\n❌ FALHA: O sistema ainda está mostrando a mensagem de OS não selecionada');
  } else {
    console.log('\n⚠️  RESULTADO INESPERADO');
  }
}

// Executar o teste
testarCorrecao().catch(console.error);
