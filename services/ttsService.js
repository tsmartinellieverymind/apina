// Serviço de TTS usando Google Cloud Text-to-Speech
// Para funcionar, instale a lib: npm install @google-cloud/text-to-speech
// E configure a variável de ambiente GOOGLE_APPLICATION_CREDENTIALS com o caminho do JSON da sua conta de serviço Google

const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');
const path = require('path');

const client = new textToSpeech.TextToSpeechClient();

/**
 * Gera um arquivo de áudio a partir de um texto usando Google Cloud TTS
 * @param {string} text Texto a ser convertido em fala
 * @param {string} [lang='pt-BR'] Idioma (ex: 'pt-BR')
 * @param {string} [voiceName='pt-BR-Neural2-B'] Nome da voz (consulte docs Google)
 * @param {string} [outputDir='./tmp'] Diretório para salvar o arquivo
 * @returns {Promise<string>} Caminho absoluto do arquivo gerado
 */
async function gerarAudio(text, lang = 'pt-BR', voiceName = 'pt-BR-Neural2-B', outputDir = './tmp') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const request = {
    input: { text },
    voice: { languageCode: lang, name: voiceName },
    audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 },
  };
  const [response] = await client.synthesizeSpeech(request);
  const filename = `tts_${Date.now()}.mp3`;
  const filepath = path.join(outputDir, filename);
  await util.promisify(fs.writeFile)(filepath, response.audioContent, 'binary');
  return path.resolve(filepath);
}

module.exports = { gerarAudio };
