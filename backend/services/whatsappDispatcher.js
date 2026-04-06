// Dispatcher que roteia envio de mensagens entre Evolution API e Meta Cloud API
// Com base no campo chip.tipo ('evolution' | 'meta')
const { PrismaClient } = require('@prisma/client');
const evolutionApi = require('./evolutionApi');
const metaApi = require('./metaApi');

const prisma = new PrismaClient();

// Resolve chip pelo valor de instanciaEvolution
async function resolveChip(instancia) {
  return prisma.chip.findFirst({ where: { instanciaEvolution: instancia } });
}

function isMeta(chip) {
  return chip?.tipo === 'meta';
}

async function enviarTexto(instancia, telefone, mensagem) {
  const chip = await resolveChip(instancia);
  if (isMeta(chip)) {
    return metaApi.enviarTexto(chip.metaPhoneNumberId, telefone, mensagem, chip.metaAccessToken);
  }
  return evolutionApi.enviarTexto(instancia, telefone, mensagem);
}

async function enviarImagem(instancia, telefone, url, legenda) {
  const chip = await resolveChip(instancia);
  if (isMeta(chip)) {
    return metaApi.enviarImagem(chip.metaPhoneNumberId, telefone, url, legenda, chip.metaAccessToken);
  }
  return evolutionApi.enviarImagem(instancia, telefone, url, legenda);
}

async function enviarAudio(instancia, telefone, url) {
  const chip = await resolveChip(instancia);
  if (isMeta(chip)) {
    return metaApi.enviarAudio(chip.metaPhoneNumberId, telefone, url, chip.metaAccessToken);
  }
  return evolutionApi.enviarAudio(instancia, telefone, url);
}

async function enviarVideo(instancia, telefone, url, legenda) {
  const chip = await resolveChip(instancia);
  if (isMeta(chip)) {
    return metaApi.enviarVideo(chip.metaPhoneNumberId, telefone, url, legenda, chip.metaAccessToken);
  }
  return evolutionApi.enviarVideo(instancia, telefone, url, legenda);
}

async function enviarDocumento(instancia, telefone, url, nomeArquivo) {
  const chip = await resolveChip(instancia);
  if (isMeta(chip)) {
    return metaApi.enviarDocumento(chip.metaPhoneNumberId, telefone, url, nomeArquivo, chip.metaAccessToken);
  }
  return evolutionApi.enviarDocumento(instancia, telefone, url, nomeArquivo);
}

async function verificarStatus(instancia) {
  const chip = await resolveChip(instancia);
  if (isMeta(chip)) {
    return metaApi.verificarStatus(chip.metaPhoneNumberId, chip.metaAccessToken);
  }
  return evolutionApi.verificarStatus(instancia);
}

async function listarGrupos(instancia) {
  const chip = await resolveChip(instancia);
  if (isMeta(chip)) return [];
  return evolutionApi.listarGrupos(instancia);
}

module.exports = {
  enviarTexto,
  enviarImagem,
  enviarAudio,
  enviarVideo,
  enviarDocumento,
  verificarStatus,
  listarGrupos,
  // Pass-through para funções exclusivas do Evolution
  criarInstancia: evolutionApi.criarInstancia,
  gerarQRCode: evolutionApi.gerarQRCode,
  gerarPairingCode: evolutionApi.gerarPairingCode,
  deletarInstancia: evolutionApi.deletarInstancia,
  configurarWebhook: evolutionApi.configurarWebhook,
  listarEtiquetas: evolutionApi.listarEtiquetas,
  aplicarEtiqueta: evolutionApi.aplicarEtiqueta,
  registrarChavePix: evolutionApi.registrarChavePix,
  buscarFotoPerfil: evolutionApi.buscarFotoPerfil,
  enviarBotoes: evolutionApi.enviarBotoes,
  enviarPix: evolutionApi.enviarPix,
};
