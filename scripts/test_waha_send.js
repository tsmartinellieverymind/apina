#!/usr/bin/env node
require('dotenv').config();
const dayjs = require('dayjs');
const { ensureSession, sendText } = require('../services/wahaService');

(async () => {
  try {
    const session = process.env.WAHA_SESSION || 'default';
    const argPhone = process.argv[2];
    const argText = process.argv.slice(3).join(' ');

    let phone = (process.env.WAHA_TEST_PHONE || argPhone || '').toString().replace(/\D/g, '');
    if (!phone) {
      console.error('Erro: defina WAHA_TEST_PHONE no .env ou passe o telefone como argumento.');
      console.error('Uso: node scripts/test_waha_send.js 5511999999999 "Mensagem opcional"');
      process.exit(1);
    }

    const text = argText || `Teste WAHA ${dayjs().format('DD/MM/YYYY HH:mm:ss')}`;

    console.log(`[TEST] Garantindo sessão '${session}' ativa...`);
    await ensureSession(session);

    console.log(`[TEST] Enviando mensagem para +${phone}...`);
    const resp = await sendText({ session, phone, text });
    console.log('[TEST] Enviado com sucesso:', resp || 'ok');
    process.exit(0);
  } catch (e) {
    console.error('[TEST] Falha ao enviar:', e?.response?.data || e.message || e);
    process.exit(2);
  }
})();
