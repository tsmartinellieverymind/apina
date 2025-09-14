const axios = require('axios');

const WAHA_BASE_URL = process.env.WAHA_BASE_URL || 'http://localhost:3000';
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';
const WAHA_TOKEN = process.env.WAHA_TOKEN || null; // algumas builds exigem token

function buildClient() {
  const headers = {};
  if (WAHA_TOKEN) {
    headers['Authorization'] = `Bearer ${WAHA_TOKEN}`;
  }
  return axios.create({
    baseURL: WAHA_BASE_URL,
    timeout: 15000,
    headers,
  });
}

async function getSessionStatus(session = WAHA_SESSION) {
  const client = buildClient();
  // algumas versões: GET /api/sessions/{session}
  // fallback: GET /api/sessions/status?name=SESSION
  try {
    const { data } = await client.get(`/api/sessions/${encodeURIComponent(session)}`);
    return data;
  } catch (_) {
    const { data } = await client.get('/api/sessions/status', { params: { name: session } });
    return data;
  }
}

async function ensureSession(session = WAHA_SESSION) {
  const client = buildClient();
  // 1) Tentar obter status primeiro
  try {
    const status = await getSessionStatus(session);
    if (status && (status.status === 'CONNECTED' || status.status === 'SCAN_QR_CODE' || status.status === 'STARTING' || status.status === 'PAIRING')) {
      return status;
    }
  } catch (_) {
    // segue para tentativa de start/criação
  }

  // 2) Tentar iniciar sessão existente
  try {
    await client.post('/api/sessions/start', { name: session });
    return await getSessionStatus(session);
  } catch (e) {
    const msg = e?.response?.data?.message || e.message || '';
    // Se já existe (422) ou conflito similar, apenas buscar status e seguir
    if (e?.response?.status === 422 || /already exists/i.test(msg)) {
      return await getSessionStatus(session);
    }
    // 3) Tentar criar sessão com start=true
    try {
      await client.post('/api/sessions', { name: session, start: true });
      return await getSessionStatus(session);
    } catch (e2) {
      // Último fallback: retornar status atual (pode estar disponível)
      return await getSessionStatus(session);
    }
  }
}

async function sendText({ session = WAHA_SESSION, phone, chatId, text, linkPreview = true, linkPreviewHighQuality = false }) {
  if (!text) throw new Error('Texto obrigatório');
  if (!phone && !chatId) throw new Error('Informe phone ou chatId');

  const client = buildClient();

  // Algumas builds usam /api/messages/sendText com phone; outras /api/sendText com chatId.
  // Tentar rota 1
  try {
    const { data } = await client.post('/api/messages/sendText', {
      session,
      phone,
      chatId,
      text,
      linkPreview,
      linkPreviewHighQuality,
    });
    return data;
  } catch (e1) {
    // Tentar rota 2
    const payload = { session, text };
    if (chatId) payload.chatId = chatId; else if (phone) payload.chatId = `${phone}@c.us`;
    const { data } = await client.post('/api/sendText', payload);
    return data;
  }
}

module.exports = {
  getSessionStatus,
  ensureSession,
  sendText,
};
