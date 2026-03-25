// TikTok Events API — dispara evento PlaceAnOrder server-side
const crypto = require('crypto');
const axios = require('axios');

function hashPhone(telefone) {
  const numero = telefone.replace(/\D/g, '');
  return crypto.createHash('sha256').update(numero).digest('hex');
}

async function dispararPurchaseTikTok({ pixelId, accessToken, telefone, valor, moeda = 'BRL', eventId }) {
  if (!pixelId || !accessToken || !telefone || !valor) {
    console.log('[TikTokConversions] Dados insuficientes, evento não disparado');
    return;
  }

  const payload = {
    pixel_code: pixelId,
    event: 'PlaceAnOrder',
    timestamp: new Date().toISOString(),
    context: {
      user: {
        phone_number: hashPhone(telefone),
      },
    },
    properties: {
      value: Number(valor),
      currency: moeda,
      order_id: eventId || `order_${Date.now()}`,
    },
  };

  try {
    const url = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
    const res = await axios.post(url, payload, {
      headers: { 'Access-Token': accessToken, 'Content-Type': 'application/json' },
      timeout: 8000,
    });
    console.log(`[TikTokConversions] PlaceAnOrder disparado: R$${valor} para ${telefone} — code: ${res.data?.code}`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('[TikTokConversions] Erro ao disparar evento:', msg);
  }
}

module.exports = { dispararPurchaseTikTok };
