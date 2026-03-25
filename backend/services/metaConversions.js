// Meta Conversions API — dispara evento Purchase server-side
const crypto = require('crypto');
const axios = require('axios');

function hashPhone(telefone) {
  // Remove tudo que não é dígito, garante formato E.164 sem +
  const numero = telefone.replace(/\D/g, '');
  return crypto.createHash('sha256').update(numero).digest('hex');
}

async function dispararPurchaseMeta({ pixelId, accessToken, telefone, valor, moeda = 'BRL', eventId }) {
  if (!pixelId || !accessToken || !telefone || !valor) {
    console.log('[MetaConversions] Dados insuficientes, evento não disparado');
    return;
  }

  const payload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'other',
      event_id: eventId || `purchase_${Date.now()}`,
      user_data: {
        ph: [hashPhone(telefone)],
      },
      custom_data: {
        value: Number(valor),
        currency: moeda,
      },
    }],
  };

  try {
    const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`;
    const res = await axios.post(url, payload, { timeout: 8000 });
    console.log(`[MetaConversions] Purchase disparado: R$${valor} para ${telefone} — events_received: ${res.data?.events_received}`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error('[MetaConversions] Erro ao disparar evento:', msg);
  }
}

module.exports = { dispararPurchaseMeta };
