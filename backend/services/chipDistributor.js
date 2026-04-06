// Distribuidor de leads entre chips (round robin)
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

let ultimoChipIndex = 0;

// Retorna o próximo chip ativo usando round robin
async function obterProximoChip() {
  const chips = await prisma.chip.findMany({
    where: { ativo: true },
    orderBy: { id: 'asc' },
  });

  if (chips.length === 0) {
    throw new Error('Nenhum chip ativo disponível');
  }

  ultimoChipIndex = (ultimoChipIndex + 1) % chips.length;
  return chips[ultimoChipIndex];
}

// Busca chip pela instância da Evolution API (inclui inativos para receber mensagens)
// Para chips Meta, faz fallback por metaPhoneNumberId
async function buscarChipPorInstancia(instancia) {
  const chip = await prisma.chip.findFirst({ where: { instanciaEvolution: instancia } });
  if (chip) return chip;
  return prisma.chip.findFirst({ where: { metaPhoneNumberId: instancia } });
}

module.exports = { obterProximoChip, buscarChipPorInstancia };
