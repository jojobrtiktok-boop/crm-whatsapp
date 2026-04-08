// Meta Conversions API — dispara evento Purchase server-side
const crypto = require('crypto');
const axios = require('axios');

function hashPhone(telefone) {
  // Remove tudo que não é dígito, garante formato E.164 sem +
  const numero = telefone.replace(/\D/g, '');
  return crypto.createHash('sha256').update(numero).digest('hex');
}

async function dispararEvento({ pixelId, accessToken, eventName, telefone, valor, moeda = 'BRL', eventId }) {
  if (!pixelId || !accessToken || !telefone) {
    console.log('[MetaConversions] Dados insuficientes, evento não disparado');
    return;
  }

  const userData = { ph: [hashPhone(telefone)] };
  const customData = valor ? { value: Number(valor), currency: moeda } : {};

  const payload = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'other',
      event_id: eventId || `${eventName.toLowerCase()}_${Date.now()}`,
      user_data: userData,
      custom_data: customData,
    }],
  };

  try {
    const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`;
    const res = await axios.post(url, payload, { timeout: 8000 });
    console.log(`[MetaConversions] ${eventName} disparado para ${telefone} — events_received: ${res.data?.events_received}`);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error(`[MetaConversions] Erro ao disparar ${eventName}:`, msg);
  }
}

async function dispararPurchaseMeta({ pixelId, accessToken, telefone, valor, moeda = 'BRL', eventId }) {
  return dispararEvento({ pixelId, accessToken, eventName: 'Purchase', telefone, valor, moeda, eventId });
}

async function dispararLeadMeta({ pixelId, accessToken, telefone, eventId }) {
  return dispararEvento({ pixelId, accessToken, eventName: 'Lead', telefone, eventId });
}

module.exports = { dispararPurchaseMeta, dispararLeadMeta, dispararEvento };
