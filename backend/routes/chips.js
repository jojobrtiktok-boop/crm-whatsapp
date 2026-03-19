// Rotas de gestão de chips WhatsApp
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');

const prisma = new PrismaClient();

router.use(autenticar);

// GET /api/chips - Listar todos os chips
router.get('/', async (req, res, next) => {
  try {
    const chips = await prisma.chip.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        _count: {
          select: {
            clientes: true,
            vendas: true,
          },
        },
      },
    });
    res.json(chips);
  } catch (err) {
    next(err);
  }
});

// POST /api/chips - Criar novo chip
router.post('/', async (req, res, next) => {
  try {
    const { nome, numero, instanciaEvolution } = req.body;

    if (!nome || !numero || !instanciaEvolution) {
      return res.status(400).json({ erro: 'Nome, número e instância são obrigatórios' });
    }

    const chip = await prisma.chip.create({
      data: { nome, numero, instanciaEvolution },
    });

    res.status(201).json(chip);
  } catch (err) {
    next(err);
  }
});

// PUT /api/chips/:id - Atualizar chip
router.put('/:id', async (req, res, next) => {
  try {
    const { nome, numero, instanciaEvolution, ativo } = req.body;
    const chip = await prisma.chip.update({
      where: { id: parseInt(req.params.id) },
      data: { nome, numero, instanciaEvolution, ativo },
    });
    res.json(chip);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/chips/:id - Desativar chip
router.delete('/:id', async (req, res, next) => {
  try {
    const chip = await prisma.chip.update({
      where: { id: parseInt(req.params.id) },
      data: { ativo: false },
    });
    res.json({ mensagem: 'Chip desativado', chip });
  } catch (err) {
    next(err);
  }
});

// GET /api/chips/:id/relatorio - Relatório detalhado do chip
router.get('/:id/relatorio', async (req, res, next) => {
  try {
    const chipId = parseInt(req.params.id);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());

    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const chip = await prisma.chip.findUnique({ where: { id: chipId } });
    if (!chip) {
      return res.status(404).json({ erro: 'Chip não encontrado' });
    }

    // Vendas do dia, semana e mês
    const [vendasDia, vendasSemana, vendasMes, totalClientes] = await Promise.all([
      prisma.venda.aggregate({
        where: { chipId, status: 'confirmado', criadoEm: { gte: hoje } },
        _sum: { valor: true },
        _count: true,
      }),
      prisma.venda.aggregate({
        where: { chipId, status: 'confirmado', criadoEm: { gte: inicioSemana } },
        _sum: { valor: true },
        _count: true,
      }),
      prisma.venda.aggregate({
        where: { chipId, status: 'confirmado', criadoEm: { gte: inicioMes } },
        _sum: { valor: true },
        _count: true,
      }),
      prisma.cliente.count({ where: { chipOrigemId: chipId } }),
    ]);

    res.json({
      chip,
      totalClientes,
      dia: { vendas: vendasDia._count, valor: vendasDia._sum.valor || 0 },
      semana: { vendas: vendasSemana._count, valor: vendasSemana._sum.valor || 0 },
      mes: { vendas: vendasMes._count, valor: vendasMes._sum.valor || 0 },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
