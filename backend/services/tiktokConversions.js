// TikTok Events API — dispara evento PlaceAnOrder server-side
const crypto = require('crypto');
const axios = require('axios');

function hashPhone(telefone) {
  const numero = telefone.replace(/\D/g, '');
  return crypto.createHash('sha256').update(numero).digest('hex');
}

async function dispararEvento({ pixelId, accessToken, eventName, telefone, valor, moeda = 'BRL', eventId }) {
  if (!pixelId || !accessToken || !telefone) {
    console.log('[TikTokConversions] Dados insuficientes, evento não disparado');
    return;
  }

  const payload = {
    pixel_code: pixelId,
    event: eventName,
    timestamp: new Date().toISOString(),
    context: { user: { phone_number: hashPhone(telefone) } },
    properties: {
      ...(valor ? { value: Number(valor), currency: moeda } : {}),
      ...(eventId ? { order_id: eventId } : {}),
    },
  };

  try {
    const url = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
    const res = await axios.post(url, payload, {
      headers: { 'Access-Token': accessToken, 'Content-Type': 'application/json' },
      timeout: 8000,
    });
    console.log(`[TikTokConversions] ${eventName} disparado para ${telefone} — code: ${res.data?.code}`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error(`[TikTokConversions] Erro ao disparar ${eventName}:`, msg);
  }
}

async function dispararPurchaseTikTok({ pixelId, accessToken, telefone, valor, moeda = 'BRL', eventId }) {
  return dispararEvento({ pixelId, accessToken, eventName: 'PlaceAnOrder', telefone, valor, moeda, eventId });
}

async function dispararLeadTikTok({ pixelId, accessToken, telefone, eventId }) {
  return dispararEvento({ pixelId, accessToken, eventName: 'SubmitForm', telefone, eventId });
}

module.exports = { dispararPurchaseTikTok, dispararLeadTikTok, dispararEvento };
