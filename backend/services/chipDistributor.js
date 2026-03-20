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
async function buscarChipPorInstancia(instancia) {
  return prisma.chip.findFirst({
    where: { instanciaEvolution: instancia },
  });
}

module.exports = { obterProximoChip, buscarChipPorInstancia };
