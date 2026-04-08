// Dispatcher de eventos de conversão — roteia para Meta CAPI e TikTok Events API
// baseado no tipo do chip (evolution | meta) e nas configurações da conta
const { PrismaClient } = require('@prisma/client');
const { dispararLeadMeta, dispararPurchaseMeta } = require('./metaConversions');
const { dispararLeadTikTok, dispararPurchaseTikTok } = require('./tiktokConversions');

const prisma = new PrismaClient();

// Lê configurações da conta e retorna como objeto chave-valor
async function lerConfigs(contaId, chaves) {
  const rows = await prisma.configuracao.findMany({
    where: { chave: { in: chaves }, contaId },
  }).catch(() => []);
  return Object.fromEntries(rows.map(r => [r.chave, r.valor]));
}

// Prefixos de config por tipo de chip
// evolution → 'eventos_meta_' / 'eventos_tiktok_'
// meta      → 'eventos_meta_oficial_' / 'eventos_tiktok_oficial_'
function prefixos(tipoChip) {
  const meta   = tipoChip === 'meta' ? 'eventos_meta_oficial_'    : 'eventos_meta_';
  const tiktok = tipoChip === 'meta' ? 'eventos_tiktok_oficial_'  : 'eventos_tiktok_';
  return { meta, tiktok };
}

// Dispara evento Lead (quando novo lead chega)
async function onNovoLead({ chip, telefone, contaId }) {
  if (!chip || !telefone || !contaId) return;
  const tipoChip = chip.tipo || 'evolution';
  const { meta, tiktok } = prefixos(tipoChip);

  const chaves = [
    `${meta}ativo`, `${meta}pixel_id`, `${meta}token`, `${meta}lead`,
    `${tiktok}ativo`, `${tiktok}pixel_id`, `${tiktok}token`, `${tiktok}lead`,
  ];
  const cfg = await lerConfigs(contaId, chaves);

  // Meta CAPI Lead
  if (cfg[`${meta}ativo`] === 'true' && cfg[`${meta}lead`] === 'true' && cfg[`${meta}pixel_id`] && cfg[`${meta}token`]) {
    try {
      await dispararLeadMeta({ pixelId: cfg[`${meta}pixel_id`], accessToken: cfg[`${meta}token`], telefone });
    } catch (e) {
      console.error('[ConversionEvents] Erro Meta Lead:', e.message);
    }
  }

  // TikTok Lead
  if (cfg[`${tiktok}ativo`] === 'true' && cfg[`${tiktok}lead`] === 'true' && cfg[`${tiktok}pixel_id`] && cfg[`${tiktok}token`]) {
    try {
      await dispararLeadTikTok({ pixelId: cfg[`${tiktok}pixel_id`], accessToken: cfg[`${tiktok}token`], telefone });
    } catch (e) {
      console.error('[ConversionEvents] Erro TikTok Lead:', e.message);
    }
  }
}

// Dispara evento Purchase (quando comprovante é confirmado)
async function onPurchase({ chip, telefone, valor, moeda, contaId }) {
  if (!chip || !telefone || !valor || !contaId) return;
  const tipoChip = chip.tipo || 'evolution';
  const { meta, tiktok } = prefixos(tipoChip);

  const chaves = [
    `${meta}ativo`, `${meta}pixel_id`, `${meta}token`, `${meta}purchase`,
    `${tiktok}ativo`, `${tiktok}pixel_id`, `${tiktok}token`, `${tiktok}purchase`,
  ];
  const cfg = await lerConfigs(contaId, chaves);

  // Meta CAPI Purchase
  const metaAtivo = cfg[`${meta}ativo`] === 'true';
  const metaPurchase = cfg[`${meta}purchase`] !== 'false'; // default true se não configurado
  if (metaAtivo && metaPurchase && cfg[`${meta}pixel_id`] && cfg[`${meta}token`]) {
    try {
      await dispararPurchaseMeta({ pixelId: cfg[`${meta}pixel_id`], accessToken: cfg[`${meta}token`], telefone, valor, moeda });
    } catch (e) {
      console.error('[ConversionEvents] Erro Meta Purchase:', e.message);
    }
  }

  // TikTok Purchase
  const tiktokAtivo = cfg[`${tiktok}ativo`] === 'true';
  const tiktokPurchase = cfg[`${tiktok}purchase`] !== 'false'; // default true
  if (tiktokAtivo && tiktokPurchase && cfg[`${tiktok}pixel_id`] && cfg[`${tiktok}token`]) {
    try {
      await dispararPurchaseTikTok({ pixelId: cfg[`${tiktok}pixel_id`], accessToken: cfg[`${tiktok}token`], telefone, valor, moeda });
    } catch (e) {
      console.error('[ConversionEvents] Erro TikTok Purchase:', e.message);
    }
  }
}

module.exports = { onNovoLead, onPurchase };
