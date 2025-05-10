// Classe para testar conexão com a API do GPT (OpenAI)
require('dotenv').config();
const OpenAI = require('openai');
const https = require('https');

class GptConnectionTester {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY não definida no ambiente!');
    }
    
    // Mostrar a chave mascarada para debug
    console.log('API Key (primeiros 5 caracteres):', apiKey.substring(0, 5) + '...');
    
    // Configurar o cliente OpenAI com opções adicionais
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false // ATENÇÃO: Isso ignora erros de certificado SSL (apenas para teste)
    });
    
    this.openai = new OpenAI({
      apiKey,
      httpAgent: httpsAgent,
      timeout: 30000 // 30 segundos de timeout
    });
  }

  async testConnection() {
    try {
      // Prompt simples só para testar a API
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Você é um assistente útil.' },
          { role: 'user', content: 'Responda apenas com: OK.' }
        ],
        max_tokens: 3
      });
      return {
        success: true,
        status: completion.status,
        data: completion
      };
    } catch (error) {
      // Log detalhado para depuração
      console.error('Erro completo:', error);
      if (error.response) {
        console.error('Erro da API OpenAI:', error.response.data);
      }
      return {
        success: false,
        error: error.response ? error.response.data : error.message,
        stack: error.stack
      };
    }
  }
}

module.exports = GptConnectionTester;
