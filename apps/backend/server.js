require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const conectarMongo = require('./config/mongo'); // conexão com MongoDB
const webhook = require('./routes/webhook');     // rota do bot
const { iniciarJobAtribuirSetorOS } = require('./jobs/atribuirSetorOS'); // job para atribuir setores às OS

const app = express();

// Colocar o CORS antes de qualquer outra configuração
// CORS dinâmico: restringe em produção, permite tudo em dev
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? ['https://seusite.com', 'https://outrodominio.com'] : '*',
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['X-Requested-With', 'content-type', 'Authorization', 'Accept']
}));

// Resolver preflight OPTIONS usando middleware em vez de rota
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    // Preflight request, responder com 200
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    return res.status(200).send();
  }
  next();
});

// Middleware para debug detalhado de requisições
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (Object.keys(req.body || {}).length > 0) {
    console.log('Body:', JSON.stringify(req.body));
  }
  next();
});
// Removido bodyParser.urlencoded pois não há uso explícito de x-www-form-urlencoded

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

// 👇 Rota usada pelo Twilio
app.use('/whatsapp-webhook', webhook);

// Rota mock para API de agentes
app.get('/api/agents', (req, res) => {
  res.json([
    { id: 'agent_os', name: 'Agente Padrão' },
    { id: 'suporte-tecnico', name: 'Suporte Técnico' },
    { id: 'vendas', name: 'Vendas' }
  ]);
});

// Middleware para padronizar respostas de erro
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Erro interno do servidor',
    details: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

// Rota mock para API de conteúdo de agente
app.get('/api/agents/:id', (req, res) => {
  const agentId = req.params.id;
  res.json({
    id: agentId,
    name: agentId === 'agent_os' ? 'Agente Padrão' : 
          agentId === 'suporte-tecnico' ? 'Suporte Técnico' : 'Vendas',
    config: {
      welcomeMessage: 'Olá! Como posso ajudar você hoje?',
      fallbackMessage: 'Desculpe, não entendi. Pode reformular?'
    }
  });
});

// Rota de teste para verificar se o CORS está funcionando
app.get('/api/test-cors', (req, res) => {
  res.json({ message: 'CORS está funcionando corretamente!' });
});

// Rota de teste para o webhook
app.post('/test-webhook', (req, res) => {
  console.log('Recebido no test-webhook:', req.body);
  
  // Enviar headers CORS explícitos nesta resposta específica
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  
  // Simular resposta de agendamento
  let resposta = 'Teste de webhook funcionando! Recebi sua mensagem: ' + (req.body.Body || 'sem conteúdo');
  
  // Se a mensagem contiver palavra-chave "agendar", simular resposta de agendamento
  if (req.body.Body && req.body.Body.toLowerCase().includes('agendar')) {
    resposta = 'Podemos agendar uma visita! Temos disponibilidade nos seguintes horários:\n\n' + 
              '• Amanhã, pela manhã (sugestão principal)\n' + 
              '• Depois de amanhã, pela tarde\n' + 
              '• Sexta-feira, pela manhã\n\n' + 
              'Qual desses horários seria melhor para você?';
  }
  
  res.json({
    status: 'ok',
    response: {
      textEquivalent: resposta
    }
  });
});

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    // Tentar conectar ao MongoDB, mas não falhar se a conexão não for bem-sucedida
    const mongoConectado = await conectarMongo();
    
    // Verificar se as variáveis de ambiente para a API IXC estão configuradas
    const apiUrlConfigurada = process.env.API_URL;
    const apiTokenConfigurado = process.env.API_TOKEN;
    
    if (!apiUrlConfigurada) {
      console.log('⚠️ Aviso: URL da API IXC não configurada. Usando URL de demonstração como fallback.');
      console.log('⚠️ Recomenda-se configurar a variável API_URL no arquivo .env para ambiente de produção.');
    }
    
    if (!apiTokenConfigurado) {
      console.log('⚠️ Aviso: Token da API IXC não configurado. Configure a variável API_TOKEN no arquivo .env');
    }
    
    // Verificar se o job de atribuição de setores está habilitado
    const jobSetorHabilitado = process.env.ENABLE_SETOR_JOB === 'true'; // Por padrão desabilitado
    
    // Iniciar o job para atribuir setores às OS apenas se estiver habilitado e o MongoDB estiver conectado
    if (mongoConectado && jobSetorHabilitado) {
      try {
        const { iniciarJobAtribuirSetorOS } = require('./jobs/atribuirSetorOS');
        
        // Verificar se o token da API está configurado (URL pode usar fallback)
        if (apiTokenConfigurado) {
          const jobIniciado = iniciarJobAtribuirSetorOS();
          if (jobIniciado) {
            console.log('✅ Job de atribuição de setores iniciado com sucesso!');
          } else {
            console.log('⚠️ Job de atribuição de setores não pôde ser iniciado.');
            console.log('Verifique se a variável API_TOKEN está configurada corretamente no arquivo .env.');
          }
        } else {
          console.log('⚠️ Job de atribuição de setores não pôde ser iniciado.');
          console.log('Verifique se a variável API_TOKEN está configurada no arquivo .env.');
        }
      } catch (jobError) {
        console.error('❌ Erro ao iniciar job de atribuição de setores:', jobError);
        console.log('O servidor continuará funcionando, mas o job de atribuição de setores não estará ativo.');
      }
    } else if (mongoConectado && !jobSetorHabilitado) {
      console.log('ℹ️ Job de atribuição de setores está desabilitado (ENABLE_SETOR_JOB=false).');
      console.log('Para habilitar, defina ENABLE_SETOR_JOB=true no arquivo .env.');
    } else if (!mongoConectado) {
      console.log('⚠️ Servidor iniciando sem conexão com MongoDB. Job de atribuição de setores não será iniciado.');
    }
    
    // Iniciar o servidor independentemente da conexão com o MongoDB
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Erro fatal ao iniciar o servidor:', error);
    process.exit(1);
  }
})();
