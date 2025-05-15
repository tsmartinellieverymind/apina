const os = require('os');
const path = require('path');
const fs = require('fs');
const util = require('util');

// 🔐 Seta o caminho absoluto da credencial ANTES de tudo
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(__dirname, '../app/secrets/text-to-speech-458821-4c53ac96822b.json');
console.log('[Init] GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);

// 🌐 Mostra IP local para confirmar ambiente
const interfaces = os.networkInterfaces();
for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      console.log(`[Net] IP local detectado: ${iface.address} (${name})`);
    }
  }
}

console.log('[Init] Importando @google-cloud/text-to-speech...');
const textToSpeech = require('@google-cloud/text-to-speech');

console.log('[Init] Criando cliente TTS...');
let client;
try {
  client = new textToSpeech.TextToSpeechClient();
  console.log('[Init] Cliente TTS criado com sucesso');
} catch (e) {
  console.error('❌ Erro ao instanciar o client TTS:', e.message);
  process.exit(1);
}

console.log('[Main] Função principal definida.');

async function gerarAudioDeTeste() {
  console.log('[TTS] Iniciando geração...');

  const texto = 'Olá, Thiago! Este é um teste completo com debug do Google Text-to-Speech.';
  const request = {
    input: { text: texto },
    voice: {
      languageCode: 'pt-BR',
      name: 'pt-BR-Neural2-B',
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 1.0,
    },
  };

  try {
    console.time('[TTS] Tempo de requisição');
    console.log('[TTS] Enviando synthesizeSpeech request...');

    const [response] = await client.synthesizeSpeech(request);

    console.timeEnd('[TTS] Tempo de requisição');
    console.log('[TTS] Resposta recebida com sucesso');

    const outputPath = path.resolve(__dirname, 'teste-audio.mp3');
    await util.promisify(fs.writeFile)(outputPath, response.audioContent, 'binary');

    console.log(`✅ Áudio gerado em: ${outputPath}`);
  } catch (err) {
    console.error('❌ [TTS] Erro durante a chamada synthesizeSpeech');
    console.error('[Detalhes]', err?.message || err);
    console.error('[Stack]', err?.stack || 'sem stack');
    if (err?.code) console.error('[gRPC Code]', err.code);
  }
}

console.log('[Main] Executando gerarAudioDeTeste...');
gerarAudioDeTeste()
  .then(() => console.log('[Main] Finalizado com sucesso.'))
  .catch((err) => {
    console.error('[Main] Falha geral:', err.message);
    console.error(err);
  });
