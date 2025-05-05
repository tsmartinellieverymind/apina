require('dotenv').config({ path: '../.env' }); // Garante que as variáveis de ambiente sejam carregadas
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path'); // Corrigido
const { uploadToS3 } = require('./s3Service'); // Importa a função de upload do s3Service

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = '21m00Tcm4TlvDq8ikWAM'; // Exemplo: ID de voz padrão, ajuste se necessário
const modelId = 'eleven_multilingual_v2'; // Modelo mais recente
const outputDir = '/tmp'; // Usar diretório temporário padrão do sistema

/**
 * Gera áudio usando a API ElevenLabs, faz upload para S3 e retorna a URL pública.
 * @param {string} texto - O texto a ser convertido em áudio.
 * @returns {Promise<string>} - A URL pública do arquivo de áudio no S3.
 * @throws {Error} - Se houver falha na geração ou upload.
 */
async function gerarAudioUrl(texto) {
  if (!apiKey) {
    throw new Error('Chave da API ElevenLabs não configurada (ELEVENLABS_API_KEY).');
  }
  if (!texto) {
    throw new Error('Texto para geração de áudio não pode ser vazio.');
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const headers = {
    'Accept': 'audio/mpeg',
    'Content-Type': 'application/json',
    'xi-api-key': apiKey,
  };
  const data = {
    text: texto,
    model_id: modelId,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      // style: 0.0, // ajuste conforme necessário para o modelo v2
      // use_speaker_boost: true
    }
  };

  console.log('[ElevenLabs] Gerando áudio...');
  try {
    const response = await axios.post(url, data, { headers, responseType: 'arraybuffer' });

    if (response.status !== 200) {
      throw new Error(`Erro na API ElevenLabs: ${response.status} ${response.statusText}`);
    }

    const audioBuffer = Buffer.from(response.data);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `audio-${timestamp}.mp3`;
    
    console.log(`[ElevenLabs] Enviando áudio (${fileName}) para S3...`);
    const s3Url = await uploadToS3(fileName, audioBuffer);
    console.log(`[ElevenLabs] Áudio disponível em: ${s3Url}`);
    return s3Url;

  } catch (error) {
    let errorMessage = 'Falha ao gerar ou fazer upload do áudio do ElevenLabs.';
    // Verifica se é um erro da API (Axios)
    if (error.response) {
      console.error('[ElevenLabs] Erro da API:', error.response.status, error.response.data);
      // Tenta extrair uma mensagem mais específica do detalhe do erro
      if (error.response.data && error.response.data.detail && error.response.data.detail.message) {
        errorMessage = `Erro da API ElevenLabs: ${error.response.data.detail.message}`;
      } else if (error.response.data && error.response.data.detail && error.response.data.detail.status) {
          errorMessage = `Erro da API ElevenLabs: ${error.response.data.detail.status}`;
      } else {
         // Se não conseguir extrair, loga o buffer como antes para debug, mas não o usa na mensagem final
         console.error('[ElevenLabs] Resposta de erro da API (Buffer/JSON):', error.response.data);
      }
    } else {
      // Outros erros (rede, sistema de arquivos ANTES do upload, etc.)
      console.error('[ElevenLabs] Erro inesperado:', error.message);
      errorMessage = `Erro inesperado no processo de áudio: ${error.message}`;
    }

    // Limpa o arquivo temporário se ele existir e ocorreu erro ANTES do upload
    const tempFilePath = path.join(outputDir, `audio-error-${Date.now()}.mp3`);
    try {
      if (await fs.stat(tempFilePath)) {
         await fs.unlink(tempFilePath);
         console.log('[ElevenLabs] Arquivo temporário de erro removido:', tempFilePath);
      }
    } catch (cleanupError) {
       // Ignora erros ao limpar, o erro principal já ocorreu
       if (cleanupError.code !== 'ENOENT') {
           console.warn('[ElevenLabs] Aviso ao tentar limpar arquivo temporário após erro:', cleanupError.message);
       }
    }
    
    // Propaga um erro mais claro
    throw new Error(errorMessage);
  }
}

module.exports = { gerarAudioUrl };
