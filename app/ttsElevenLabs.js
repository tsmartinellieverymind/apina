// Desativa verificação de certificado SSL para desenvolvimento
// IMPORTANTE: Remover em produção
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Carrega as variáveis de ambiente com caminho absoluto para garantir
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Debug das variáveis de ambiente
const bucket = process.env.AWS_S3_BUCKET;
const elevenlabsKey = process.env.ELEVENLABS_API_KEY;

console.log('===== TTS ELEVENLABS =====');
console.log(`Bucket S3: ${bucket || 'não definido'}`);
console.log(`ElevenLabs API: ${elevenlabsKey ? '✅ Configurada' : '❌ Não configurada'}`);

const axios = require('axios');
const fs = require('fs');
const { uploadToS3 } = require('../services/s3Service'); // importa o upload

async function gerarComElevenLabs(texto, voiceId = 'EXAVITQu4vr4xnSDxMaL') {
  // Usa a variável de ambiente para a API key
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error('API key do ElevenLabs não configurada no .env');
  }
  
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  try {
    console.log('[TTS] Gerando áudio com ElevenLabs...');
    const resposta = await axios.post(
      url,
      {
        text: texto,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.4, similarity_boost: 0.85 }
      },
      {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        responseType: 'arraybuffer'
      }
    );

    // Salva o arquivo localmente com timestamp para evitar sobrescrita
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const nomeArquivo = `audio-${timestamp}.mp3`;
    const caminhoSaida = path.resolve(__dirname, nomeArquivo);
    
    fs.writeFileSync(caminhoSaida, resposta.data);
    console.log('✅ Áudio gerado localmente:', caminhoSaida);

    // Upload para S3 com tratamento de erro melhorado
    try {
      console.log('📡 Enviando para S3...');
      const urlPublica = await uploadToS3(caminhoSaida, nomeArquivo);
      console.log('🌐 Áudio disponível em:', urlPublica);
      return { sucesso: true, urlLocal: caminhoSaida, urlPublica };
    } catch (erroS3) {
      console.error('❌ Erro no upload para S3:', erroS3.message);
      // Retorna sucesso parcial, já que o áudio foi gerado localmente
      return { sucesso: true, urlLocal: caminhoSaida, urlPublica: null, erroS3: erroS3.message };
    }
  } catch (err) {
    console.error('❌ Erro ao gerar áudio com ElevenLabs:', err.message);
    if (err?.response?.data) {
      console.error('Detalhes da API:', err.response.data);
    }
    throw err; // Propaga o erro para tratamento externo
  }
}

// Função principal de execução
async function executar() {
  try {
    console.log('[MAIN] Gerando áudio de teste...');
    const resultado = await gerarComElevenLabs('Olá! Este áudio foi gerado pelo ElevenLabs e enviado para o S3.');
    
    if (resultado?.sucesso) {
      console.log('\n✅ PROCESSO CONCLUÍDO COM SUCESSO');
      console.log(`Áudio local: ${resultado.urlLocal}`);
      
      if (resultado.urlPublica) {
        console.log(`Áudio na nuvem: ${resultado.urlPublica}`);
      } else {
        console.log('⚠️ O áudio foi gerado localmente, mas não foi possível fazer upload para S3');
        console.log('Erro S3:', resultado.erroS3);
      }
    }
  } catch (erro) {
    console.error('\n❌ FALHA NO PROCESSO');
    console.error(`Erro: ${erro.message}`);
    process.exit(1);
  }
}

// Executa o script
executar();
