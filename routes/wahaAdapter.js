const express = require('express');

// Middleware que adapta o payload do WAHA para um formato semelhante ao do Twilio
// para reaproveitar o pipeline já existente em routes/webhook.js
// Deduplicação persistente em arquivo com TTL curto
const { isDuplicate } = require('../services/dedupStore');

module.exports = function wahaAdapter(req, res, next) {
  try {
    const body = req.body || {};

    // Se já parece Twilio (tem Body), não faz nada
    if (typeof body.Body === 'string' && body.Body.length > 0) {
      return next();
    }

    // Possíveis formatos do WAHA
    // 1) { event: 'message', data: { chatId|from, text, fromMe } }
    // 2) { messages: [ { chatId|from, text, fromMe } ] }
    // 3) { message: { ... } }
    // 4) { payload: { from, body, ... } }  ← formato observado nos logs

    const candidates = [];
    if (body?.event === 'message' && body?.data) candidates.push(body.data);
    if (Array.isArray(body?.messages)) candidates.push(...body.messages);
    if (body?.message) candidates.push(body.message);
    if (body?.payload) candidates.push(body.payload);

    // Procura a primeira mensagem que não seja do próprio bot
    const evt = candidates.find(e => e && e.fromMe === false);

    if (evt) {
      const chatIdRaw = evt.chatId || evt.from || evt.remoteJid || '';
      // Ignorar eventos de status/broadcast
      if (chatIdRaw === 'status@broadcast' || String(chatIdRaw).includes('@broadcast')) {
        return next();
      }
      // Extrair ID apenas para repassar ao webhook (dedup será aplicado lá)
      const msgId = (evt?.id && (evt.id._serialized || evt.id)) || (evt?._data?.id && (evt._data.id._serialized || evt._data.id)) || null;
      const phoneMatch = String(chatIdRaw).match(/^(\d+)@c\.us$/);
      const phone = evt.phone || (phoneMatch ? phoneMatch[1] : null);

      // Texto pode vir em diferentes campos
      const text = (evt?.text?.body || evt?.text || evt?.message || evt?.body || '').toString();

      // Mapeia para campos estilo Twilio
      if (text) body.Body = text;
      if (phone) body.From = `whatsapp:+${phone}`;

      // Também repassa IDs brutos para uso futuro e debug mínimo
      body._waha = { chatId: chatIdRaw, phone, messageId: msgId };

      // Log conciso da adaptação (não logar payload inteiro)
      console.log('[WAHA-ADAPTER] mapped ->', { Body: body.Body, From: body.From });

      req.body = body;
      return next();
    }
  } catch (e) {
    // Apenas log e segue — não vamos quebrar o fluxo
    console.error('[WAHA-ADAPTER] erro ao adaptar payload:', e.message);
  }
  next();
};
