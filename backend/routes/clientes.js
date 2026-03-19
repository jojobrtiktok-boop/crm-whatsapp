// Rotas de gestão de clientes/leads
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');

const prisma = new PrismaClient();

router.use(autenticar);

// GET /api/clientes - Listar clientes com filtros
router.get('/', async (req, res, next) => {
  try {
    const { status, chipId, tagId, busca, pagina = 1, limite = 50 } = req.query;
    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    const where = { contaId: req.usuario.contaId };
    if (status) where.status = status;
    if (chipId) where.chipOrigemId = parseInt(chipId);
    if (busca) {
      where.OR = [
        { nome: { contains: busca, mode: 'insensitive' } },
        { telefone: { contains: busca } },
      ];
    }
    if (tagId) {
      where.tags = { some: { tagId: parseInt(tagId) } };
    }

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        include: {
          chipOrigem: { select: { id: true, nome: true } },
          tags: { include: { tag: true } },
          _count: { select: { vendas: true, conversas: true } },
        },
        orderBy: { atualizadoEm: 'desc' },
        skip,
        take: parseInt(limite),
      }),
      prisma.cliente.count({ where }),
    ]);

    res.json({
      clientes,
      total,
      paginas: Math.ceil(total / parseInt(limite)),
      paginaAtual: parseInt(pagina),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/clientes/:id - Detalhe do cliente
router.get('/:id', async (req, res, next) => {
  try {
    const cliente = await prisma.cliente.findFirst({
      where: { id: parseInt(req.params.id), contaId: req.usuario.contaId },
      include: {
        chipOrigem: { select: { id: true, nome: true } },
        tags: { include: { tag: true } },
        anotacoes: { orderBy: { criadoEm: 'desc' } },
        vendas: { orderBy: { criadoEm: 'desc' }, take: 10 },
        _count: { select: { vendas: true, conversas: true } },
      },
    });

    if (!cliente) {
      return res.status(404).json({ erro: 'Cliente não encontrado' });
    }

    res.json(cliente);
  } catch (err) {
    next(err);
  }
});

// POST /api/clientes - Criar cliente
router.post('/', async (req, res, next) => {
  try {
    const { nome, telefone, chipOrigemId, status } = req.body;

    if (!telefone) {
      return res.status(400).json({ erro: 'Telefone é obrigatório' });
    }

    const cliente = await prisma.cliente.create({
      data: {
        nome,
        telefone: telefone.replace(/\D/g, ''),
        chipOrigemId,
        status: status || 'novo',
        contaId: req.usuario.contaId,
      },
      include: { chipOrigem: { select: { id: true, nome: true } } },
    });

    // Emitir evento de novo lead via WebSocket
    const io = req.app.get('io');
    if (io) io.emit('lead:novo', cliente);

    res.status(201).json(cliente);
  } catch (err) {
    next(err);
  }
});

// PUT /api/clientes/:id - Atualizar cliente
router.put('/:id', async (req, res, next) => {
  try {
    const { nome, status, telefone } = req.body;
    const clienteId = parseInt(req.params.id);
    // Verify ownership
    const existe = await prisma.cliente.findFirst({ where: { id: clienteId, contaId: req.usuario.contaId } });
    if (!existe) {
      return res.status(404).json({ erro: 'Cliente não encontrado' });
    }
    const cliente = await prisma.cliente.update({
      where: { id: clienteId },
      data: { nome, status, telefone },
      include: {
        chipOrigem: { select: { id: true, nome: true } },
        tags: { include: { tag: true } },
      },
    });

    // Emitir evento de atualização
    const io = req.app.get('io');
    if (io) io.emit('lead:atualizado', cliente);

    res.json(cliente);
  } catch (err) {
    next(err);
  }
});

// GET /api/clientes/:id/conversas - Histórico de conversas
router.get('/:id/conversas', async (req, res, next) => {
  try {
    const { pagina = 1, limite = 100 } = req.query;
    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    const conversas = await prisma.conversa.findMany({
      where: { clienteId: parseInt(req.params.id) },
      include: { chip: { select: { id: true, nome: true } } },
      orderBy: { criadoEm: 'asc' },
      skip,
      take: parseInt(limite),
    });

    res.json(conversas);
  } catch (err) {
    next(err);
  }
});

// POST /api/clientes/:id/tags - Adicionar tag ao cliente
router.post('/:id/tags', async (req, res, next) => {
  try {
    const { tagId } = req.body;
    await prisma.clienteTag.create({
      data: {
        clienteId: parseInt(req.params.id),
        tagId: parseInt(tagId),
      },
    });
    res.status(201).json({ mensagem: 'Tag adicionada' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/clientes/:id/tags/:tagId - Remover tag do cliente
router.delete('/:id/tags/:tagId', async (req, res, next) => {
  try {
    await prisma.clienteTag.delete({
      where: {
        clienteId_tagId: {
          clienteId: parseInt(req.params.id),
          tagId: parseInt(req.params.tagId),
        },
      },
    });
    res.json({ mensagem: 'Tag removida' });
  } catch (err) {
    next(err);
  }
});

// POST /api/clientes/:id/anotacoes - Adicionar anotação
router.post('/:id/anotacoes', async (req, res, next) => {
  try {
    const { texto } = req.body;
    if (!texto) {
      return res.status(400).json({ erro: 'Texto é obrigatório' });
    }

    const anotacao = await prisma.anotacao.create({
      data: {
        clienteId: parseInt(req.params.id),
        texto,
      },
    });

    res.status(201).json(anotacao);
  } catch (err) {
    next(err);
  }
});

// GET /api/clientes/:id/foto - Buscar foto de perfil do WhatsApp
router.get('/:id/foto', async (req, res, next) => {
  try {
    const cliente = await prisma.cliente.findFirst({
      where: { id: parseInt(req.params.id), contaId: req.usuario.contaId },
      include: { chipOrigem: { select: { instanciaEvolution: true } } },
    });

    if (!cliente || !cliente.chipOrigem) {
      return res.json({ url: null });
    }

    const evolutionApi = require('../services/evolutionApi');
    const url = await evolutionApi.buscarFotoPerfil(cliente.chipOrigem.instanciaEvolution, cliente.telefone);
    res.json({ url });
  } catch {
    res.json({ url: null });
  }
});

module.exports = router;
