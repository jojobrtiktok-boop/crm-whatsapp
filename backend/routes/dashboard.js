// Rotas do dashboard - métricas e resumos
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');

const prisma = new PrismaClient();

router.use(autenticar);

// GET /api/dashboard/resumo - Resumo geral (dia, semana, mês)
router.get('/resumo', async (req, res, next) => {
  try {
    const { chipId } = req.query;
    // Início do dia no horário de Brasília (UTC-3) = 03:00 UTC
    const agora = new Date();
    const brazilOffset = 3 * 60 * 60 * 1000; // UTC-3 em ms
    const hojeStr = new Date(agora.getTime() - brazilOffset).toISOString().split('T')[0];
    const hoje = new Date(hojeStr + 'T03:00:00.000Z'); // 00:00 Brasília = 03:00 UTC

    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());

    const inicioMes = new Date(hojeStr.substring(0, 7) + '-01T03:00:00.000Z'); // 1st of month at 00:00 Brasília

    const whereBase = { contaId: req.usuario.contaId };
    if (chipId) whereBase.chipId = parseInt(chipId);

    const clienteWhereBase = { chipOrigem: { contaId: req.usuario.contaId } };
    if (chipId) clienteWhereBase.chipOrigemId = parseInt(chipId);

    // Vendas confirmadas
    const [vendasDia, vendasSemana, vendasMes] = await Promise.all([
      prisma.venda.aggregate({
        where: { ...whereBase, status: 'confirmado', criadoEm: { gte: hoje } },
        _sum: { valor: true },
        _count: true,
      }),
      prisma.venda.aggregate({
        where: { ...whereBase, status: 'confirmado', criadoEm: { gte: inicioSemana } },
        _sum: { valor: true },
        _count: true,
      }),
      prisma.venda.aggregate({
        where: { ...whereBase, status: 'confirmado', criadoEm: { gte: inicioMes } },
        _sum: { valor: true },
        _count: true,
      }),
    ]);

    // Leads do dia, semana e mês
    const [leadsDia, leadsSemana, leadsMes] = await Promise.all([
      prisma.cliente.count({
        where: { ...clienteWhereBase, criadoEm: { gte: hoje } },
      }),
      prisma.cliente.count({
        where: { ...clienteWhereBase, criadoEm: { gte: inicioSemana } },
      }),
      prisma.cliente.count({
        where: { ...clienteWhereBase, criadoEm: { gte: inicioMes } },
      }),
    ]);

    // Total geral
    const [totalClientes, totalVendas] = await Promise.all([
      prisma.cliente.count({ where: { chipOrigem: { contaId: req.usuario.contaId } } }),
      prisma.venda.aggregate({
        where: { status: 'confirmado', contaId: req.usuario.contaId },
        _sum: { valor: true },
        _count: true,
      }),
    ]);

    // Taxa de conversão (leads que compraram / total de leads)
    const leadCompraram = await prisma.cliente.count({ where: { status: 'comprou', chipOrigem: { contaId: req.usuario.contaId } } });
    const taxaConversao = totalClientes > 0 ? ((leadCompraram / totalClientes) * 100).toFixed(1) : 0;

    res.json({
      dia: {
        vendas: vendasDia._count,
        valor: vendasDia._sum.valor || 0,
        leads: leadsDia,
      },
      semana: {
        vendas: vendasSemana._count,
        valor: vendasSemana._sum.valor || 0,
        leads: leadsSemana,
      },
      mes: {
        vendas: vendasMes._count,
        valor: vendasMes._sum.valor || 0,
        leads: leadsMes,
      },
      geral: {
        totalClientes,
        totalVendas: totalVendas._count,
        totalArrecadado: totalVendas._sum.valor || 0,
        taxaConversao: parseFloat(taxaConversao),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/comparativo-chips - Comparativo entre chips
router.get('/comparativo-chips', async (req, res, next) => {
  try {
    const { periodo = 'mes' } = req.query;
    // Início do dia no horário de Brasília (UTC-3) = 03:00 UTC
    const agora = new Date();
    const brazilOffset = 3 * 60 * 60 * 1000; // UTC-3 em ms
    const hojeStr = new Date(agora.getTime() - brazilOffset).toISOString().split('T')[0];
    const hoje = new Date(hojeStr + 'T03:00:00.000Z'); // 00:00 Brasília = 03:00 UTC

    let dataInicio;
    if (periodo === 'dia') {
      dataInicio = hoje;
    } else if (periodo === 'semana') {
      dataInicio = new Date(hoje);
      dataInicio.setDate(hoje.getDate() - hoje.getDay());
    } else {
      dataInicio = new Date(hojeStr.substring(0, 7) + '-01T03:00:00.000Z'); // 1st of month at 00:00 Brasília
    }

    const chips = await prisma.chip.findMany({
      where: { ativo: true, contaId: req.usuario.contaId },
      select: { id: true, nome: true, numero: true },
    });

    const comparativo = await Promise.all(
      chips.map(async (chip) => {
        const [vendas, leads] = await Promise.all([
          prisma.venda.aggregate({
            where: { chipId: chip.id, status: 'confirmado', criadoEm: { gte: dataInicio } },
            _sum: { valor: true },
            _count: true,
          }),
          prisma.cliente.count({
            where: { chipOrigemId: chip.id, criadoEm: { gte: dataInicio } },
          }),
        ]);

        return {
          chip: chip.nome,
          chipId: chip.id,
          vendas: vendas._count,
          valor: vendas._sum.valor || 0,
          leads,
        };
      })
    );

    // Ordenar por valor (maior primeiro)
    comparativo.sort((a, b) => b.valor - a.valor);

    res.json(comparativo);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/chips-resumo - Resumo por chip (dia e semana)
router.get('/chips-resumo', async (req, res, next) => {
  try {
    // Início do dia no horário de Brasília (UTC-3) = 03:00 UTC
    const agora = new Date();
    const brazilOffset = 3 * 60 * 60 * 1000; // UTC-3 em ms
    const hojeStr = new Date(agora.getTime() - brazilOffset).toISOString().split('T')[0];
    const hoje = new Date(hojeStr + 'T03:00:00.000Z'); // 00:00 Brasília = 03:00 UTC
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - 6); // últimos 7 dias

    const chips = await prisma.chip.findMany({
      where: { ativo: true, contaId: req.usuario.contaId },
      select: { id: true, nome: true, numero: true },
    });

    const resumo = await Promise.all(
      chips.map(async (chip) => {
        const [dia, semana, leadsDia] = await Promise.all([
          prisma.venda.aggregate({
            where: { chipId: chip.id, status: 'confirmado', criadoEm: { gte: hoje } },
            _sum: { valor: true },
            _count: true,
          }),
          prisma.venda.aggregate({
            where: { chipId: chip.id, status: 'confirmado', criadoEm: { gte: inicioSemana } },
            _sum: { valor: true },
            _count: true,
          }),
          prisma.cliente.count({ where: { chipOrigemId: chip.id, criadoEm: { gte: hoje } } }),
        ]);

        return {
          id: chip.id,
          nome: chip.nome,
          numero: chip.numero,
          dia: { vendas: dia._count, valor: dia._sum.valor || 0, leads: leadsDia },
          semana: { vendas: semana._count, valor: semana._sum.valor || 0 },
        };
      })
    );

    res.json(resumo);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/vendas-recentes - Últimas vendas
router.get('/vendas-recentes', async (req, res, next) => {
  try {
    const vendas = await prisma.venda.findMany({
      where: { contaId: req.usuario.contaId },
      take: 20,
      orderBy: { criadoEm: 'desc' },
      include: {
        cliente: { select: { id: true, nome: true, telefone: true } },
        chip: { select: { id: true, nome: true } },
      },
    });

    res.json(vendas);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
