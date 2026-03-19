// Rotas de gestao de chips WhatsApp
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');
const evolutionApi = require('../services/evolutionApi');

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

    // Buscar status de cada chip na Evolution API
    const chipsComStatus = await Promise.all(
      chips.map(async (chip) => {
        try {
          const status = await evolutionApi.verificarStatus(chip.instanciaEvolution);
          return { ...chip, statusConexao: status?.state || status?.instance?.state || 'close' };
        } catch {
          return { ...chip, statusConexao: 'close' };
        }
      })
    );

    res.json(chipsComStatus);
  } catch (err) {
    next(err);
  }
});

// POST /api/chips - Criar novo chip (cria instancia na Evolution API)
router.post('/', async (req, res, next) => {
  try {
    const { nome, numero } = req.body;

    if (!nome || !numero) {
      return res.status(400).json({ erro: 'Nome e numero sao obrigatorios' });
    }

    // Gerar nome da instancia a partir do nome do chip
    const instanciaEvolution = nome.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    // Criar instancia na Evolution API
    try {
      await evolutionApi.criarInstancia(instanciaEvolution);
    } catch (err) {
      if (!err.response || err.response.status !== 409) {
        console.error('Erro ao criar instancia Evolution:', err.response?.data || err.message);
      }
    }

    // Salvar chip no banco
    const chip = await prisma.chip.create({
      data: { nome, numero, instanciaEvolution },
    });

    res.status(201).json(chip);
  } catch (err) {
    next(err);
  }
});

// GET /api/chips/:id/qrcode - Gerar QR Code para conectar WhatsApp
router.get('/:id/qrcode', async (req, res, next) => {
  try {
    const chip = await prisma.chip.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!chip) {
      return res.status(404).json({ erro: 'Chip nao encontrado' });
    }

    // Tentar criar instancia primeiro (caso nao exista)
    try {
      await evolutionApi.criarInstancia(chip.instanciaEvolution);
    } catch {
      // Instancia ja existe, ok
    }

    // Gerar QR Code
    const resultado = await evolutionApi.gerarQRCode(chip.instanciaEvolution);
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao gerar QR Code:', err.response?.data || err.message);
    res.status(500).json({ erro: 'Erro ao gerar QR Code', detalhe: err.response?.data || err.message });
  }
});

// GET /api/chips/:id/status - Verificar status da conexao
router.get('/:id/status', async (req, res, next) => {
  try {
    const chip = await prisma.chip.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!chip) {
      return res.status(404).json({ erro: 'Chip nao encontrado' });
    }

    const status = await evolutionApi.verificarStatus(chip.instanciaEvolution);
    res.json(status);
  } catch (err) {
    console.error('Erro ao verificar status:', err.response?.data || err.message);
    res.status(500).json({ erro: 'Erro ao verificar status' });
  }
});

// POST /api/chips/:id/webhook - Configurar webhook do chip
router.post('/:id/webhook', async (req, res, next) => {
  try {
    const chip = await prisma.chip.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!chip) {
      return res.status(404).json({ erro: 'Chip nao encontrado' });
    }

    const webhookUrl = `${req.protocol}://${req.get('host')}/api/webhook/evolution`;
    const resultado = await evolutionApi.configurarWebhook(chip.instanciaEvolution, webhookUrl);
    res.json({ mensagem: 'Webhook configurado', resultado });
  } catch (err) {
    console.error('Erro ao configurar webhook:', err.response?.data || err.message);
    res.status(500).json({ erro: 'Erro ao configurar webhook' });
  }
});

// PUT /api/chips/:id - Atualizar chip
router.put('/:id', async (req, res, next) => {
  try {
    const { nome, numero, ativo } = req.body;
    const chip = await prisma.chip.update({
      where: { id: parseInt(req.params.id) },
      data: { nome, numero, ativo },
    });
    res.json(chip);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/chips/:id - Deletar chip
router.delete('/:id', async (req, res, next) => {
  try {
    const chipId = parseInt(req.params.id);

    // Remover referências do chip nos clientes
    await prisma.cliente.updateMany({
      where: { chipOrigemId: chipId },
      data: { chipOrigemId: null },
    });

    // Remover execuções de funil vinculadas
    await prisma.funilExecucao.deleteMany({ where: { chipId } });

    // Remover comprovantes vinculados
    await prisma.comprovante.deleteMany({ where: { chipId } });

    // Remover vendas vinculadas
    await prisma.venda.deleteMany({ where: { chipId } });

    // Remover conversas vinculadas
    await prisma.conversa.deleteMany({ where: { chipId } });

    // Deletar chip
    await prisma.chip.delete({ where: { id: chipId } });

    // Tentar deletar instancia na Evolution API
    try {
      await evolutionApi.deletarInstancia(
        (await prisma.chip.findUnique({ where: { id: chipId } }))?.instanciaEvolution
      );
    } catch {}

    res.json({ mensagem: 'Chip removido com sucesso' });
  } catch (err) {
    next(err);
  }
});

// GET /api/chips/:id/relatorio - Relatorio detalhado do chip
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
      return res.status(404).json({ erro: 'Chip nao encontrado' });
    }

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
