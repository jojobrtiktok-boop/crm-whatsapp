// Rotas de gestão de vendas
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');

const prisma = new PrismaClient();

router.use(autenticar);

// GET /api/vendas - Listar vendas com filtros
router.get('/', async (req, res, next) => {
  try {
    const { status, chipId, dataInicio, dataFim, valorMin, valorMax, pagina = 1, limite = 50 } = req.query;
    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    const where = { contaId: req.usuario.contaId };
    if (status) where.status = status;
    if (chipId) where.chipId = parseInt(chipId);
    if (dataInicio || dataFim) {
      where.criadoEm = {};
      if (dataInicio) where.criadoEm.gte = new Date(dataInicio);
      if (dataFim) where.criadoEm.lte = new Date(dataFim + 'T23:59:59');
    }
    if (valorMin || valorMax) {
      where.valor = {};
      if (valorMin) where.valor.gte = parseFloat(valorMin);
      if (valorMax) where.valor.lte = parseFloat(valorMax);
    }

    const [vendas, total] = await Promise.all([
      prisma.venda.findMany({
        where,
        include: {
          cliente: { select: { id: true, nome: true, telefone: true } },
          chip: { select: { id: true, nome: true } },
          comprovantes: { select: { id: true, status: true, imagemPath: true } },
        },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: parseInt(limite),
      }),
      prisma.venda.count({ where }),
    ]);

    res.json({
      vendas,
      total,
      paginas: Math.ceil(total / parseInt(limite)),
      paginaAtual: parseInt(pagina),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/vendas/exportar - Exportar vendas em CSV
router.get('/exportar', async (req, res, next) => {
  try {
    const { status, chipId, dataInicio, dataFim } = req.query;

    const where = { contaId: req.usuario.contaId };
    if (status) where.status = status;
    if (chipId) where.chipId = parseInt(chipId);
    if (dataInicio || dataFim) {
      where.criadoEm = {};
      if (dataInicio) where.criadoEm.gte = new Date(dataInicio);
      if (dataFim) where.criadoEm.lte = new Date(dataFim + 'T23:59:59');
    }

    const vendas = await prisma.venda.findMany({
      where,
      include: {
        cliente: { select: { nome: true, telefone: true } },
        chip: { select: { nome: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });

    const { Parser } = require('json2csv');
    const campos = [
      { label: 'ID', value: 'id' },
      { label: 'Cliente', value: 'cliente.nome' },
      { label: 'Telefone', value: 'cliente.telefone' },
      { label: 'Chip', value: 'chip.nome' },
      { label: 'Valor', value: 'valor' },
      { label: 'Status', value: 'status' },
      { label: 'Descrição', value: 'descricao' },
      { label: 'Data', value: (row) => new Date(row.criadoEm).toLocaleString('pt-BR') },
    ];

    const parser = new Parser({ fields: campos, delimiter: ';' });
    const csv = parser.parse(vendas);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=vendas.csv');
    res.send('\uFEFF' + csv); // BOM para Excel reconhecer UTF-8
  } catch (err) {
    next(err);
  }
});

// GET /api/vendas/:id - Detalhe da venda
router.get('/:id', async (req, res, next) => {
  try {
    const venda = await prisma.venda.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        cliente: true,
        chip: true,
        comprovantes: true,
      },
    });

    if (!venda) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    res.json(venda);
  } catch (err) {
    next(err);
  }
});

// POST /api/vendas - Criar venda manualmente
router.post('/', async (req, res, next) => {
  try {
    const { clienteId, chipId, valor, descricao, status } = req.body;

    if (!clienteId || !chipId || !valor) {
      return res.status(400).json({ erro: 'Cliente, chip e valor são obrigatórios' });
    }

    const venda = await prisma.venda.create({
      data: {
        clienteId: parseInt(clienteId),
        chipId: parseInt(chipId),
        valor: parseFloat(valor),
        descricao,
        status: status || 'pendente',
      },
      include: {
        cliente: { select: { id: true, nome: true, telefone: true } },
        chip: { select: { id: true, nome: true } },
      },
    });

    res.status(201).json(venda);
  } catch (err) {
    next(err);
  }
});

// PUT /api/vendas/:id - Atualizar venda
router.put('/:id', async (req, res, next) => {
  try {
    const { valor, status, descricao } = req.body;
    const venda = await prisma.venda.update({
      where: { id: parseInt(req.params.id) },
      data: { valor, status, descricao },
      include: {
        cliente: { select: { id: true, nome: true } },
        chip: { select: { id: true, nome: true } },
      },
    });

    // Emitir evento se venda confirmada
    if (status === 'confirmado') {
      const io = req.app.get('io');
      if (io) io.emit('venda:confirmada', venda);
      // Push notification
      try {
        const { enviarPushParaTodos } = require('./push');
        enviarPushParaTodos({
          title: `💰 R$ ${Number(venda.valor || 0).toFixed(2).replace('.', ',')} — Venda Confirmada!`,
          body: venda.cliente?.nome || 'Venda confirmada',
          tag: 'venda',
        });
      } catch (_) {}
    }

    res.json(venda);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/vendas/todas - Excluir todas as vendas da conta
router.delete('/todas', async (req, res, next) => {
  try {
    const contaId = req.usuario.contaId;
    const vendaIds = (await prisma.venda.findMany({ where: { contaId }, select: { id: true } })).map((v) => v.id);
    if (vendaIds.length === 0) return res.json({ mensagem: 'Nenhuma venda para excluir' });

    await prisma.$transaction([
      prisma.comprovante.deleteMany({ where: { vendaId: { in: vendaIds } } }),
      prisma.venda.deleteMany({ where: { id: { in: vendaIds } } }),
    ]);

    res.json({ mensagem: 'Todas as vendas excluídas' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/vendas/:id - Excluir venda
router.delete('/:id', async (req, res, next) => {
  try {
    const vendaId = parseInt(req.params.id);
    const existe = await prisma.venda.findFirst({ where: { id: vendaId, contaId: req.usuario.contaId } });
    if (!existe) return res.status(404).json({ erro: 'Venda não encontrada' });

    await prisma.$transaction([
      prisma.comprovante.deleteMany({ where: { vendaId } }),
      prisma.venda.delete({ where: { id: vendaId } }),
    ]);

    res.json({ mensagem: 'Venda excluída' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
