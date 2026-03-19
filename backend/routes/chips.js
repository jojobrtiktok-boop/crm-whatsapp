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
      where: { contaId: req.usuario.contaId },
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

// POST /api/chips/sincronizar - Importar sessões do WAHA
router.post('/sincronizar', async (req, res, next) => {
  try {
    const axios = require('axios');
    const config = require('../config');

    // Tentar WAHA primeiro, depois Evolution API
    let sessoes = [];
    try {
      const response = await axios.get(`${config.evolution.url}/api/sessions`, {
        headers: { 'X-Api-Key': config.evolution.apiKey },
      });
      sessoes = (response.data || []).map((s) => ({
        nome: s.name,
        numero: '',
        profileName: s.name,
        isWaha: true,
      }));
    } catch {
      // Fallback: Evolution API
      const response = await axios.get(`${config.evolution.url}/instance/fetchInstances`, {
        headers: { apikey: config.evolution.apiKey },
      });
      sessoes = (response.data || []).map((inst) => ({
        nome: inst.instance?.instanceName || inst.instanceName,
        numero: inst.instance?.owner?.replace('@s.whatsapp.net', '').replace('@c.us', '') || '',
        profileName: inst.instance?.profileName || inst.instance?.instanceName,
        isWaha: false,
      }));
    }

    const importados = [];
    const jaExistentes = [];

    for (const s of sessoes) {
      if (!s.nome) continue;
      const existente = await prisma.chip.findFirst({ where: { instanciaEvolution: s.nome } });
      if (existente) { jaExistentes.push(s.nome); continue; }

      const chip = await prisma.chip.create({
        data: { nome: s.profileName || s.nome, numero: s.numero, instanciaEvolution: s.nome, contaId: req.usuario.contaId },
      });
      importados.push(chip);
    }

    res.json({ importados: importados.length, jaExistentes: jaExistentes.length, chips: importados });
  } catch (err) {
    console.error('Erro ao sincronizar:', err.response?.data || err.message);
    res.status(500).json({ erro: 'Erro ao sincronizar' });
  }
});

// POST /api/chips - Criar novo chip (só nome obrigatório)
router.post('/', async (req, res, next) => {
  try {
    const { nome } = req.body;

    if (!nome) {
      return res.status(400).json({ erro: 'Nome é obrigatorio' });
    }

    // Gerar nome único da instancia
    const base = nome.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const instanciaEvolution = `${base}-${Date.now()}`;

    // Criar instancia na Evolution API
    let erroEvolution = null;
    try {
      await evolutionApi.criarInstancia(instanciaEvolution);
      console.log(`[Chips] Instancia criada: ${instanciaEvolution}`);
    } catch (err) {
      erroEvolution = err.response?.data || err.message;
      console.error('Erro ao criar instancia Evolution:', erroEvolution);
    }

    // Salvar chip no banco mesmo se Evolution falhar
    const chip = await prisma.chip.create({
      data: { nome, numero: '', instanciaEvolution, contaId: req.usuario.contaId },
    });

    res.status(201).json({ ...chip, erroEvolution });
  } catch (err) {
    next(err);
  }
});

// GET /api/chips/:id/qrcode - Gerar QR Code para conectar WhatsApp
router.get('/:id/qrcode', async (req, res, next) => {
  try {
    const chip = await prisma.chip.findFirst({
      where: { id: parseInt(req.params.id), contaId: req.usuario.contaId },
    });

    if (!chip) {
      return res.status(404).json({ erro: 'Chip nao encontrado' });
    }

    // Verificar se ja esta conectado
    const statusAtual = await evolutionApi.verificarStatus(chip.instanciaEvolution);
    const state = statusAtual?.state || statusAtual?.instance?.state;
    if (state === 'open' || state === 'connected') {
      return res.json({ conectado: true, state });
    }

    // Gerar QR Code
    const resultado = await evolutionApi.gerarQRCode(chip.instanciaEvolution);
    console.log('[QR] Resposta Evolution:', JSON.stringify(resultado).substring(0, 200));

    // Normalizar resposta - Evolution pode retornar em formatos diferentes
    const base64 = resultado?.base64 || resultado?.qrcode?.base64 || resultado?.code;
    const pairingCode = resultado?.pairingCode;

    res.json({ base64, pairingCode, raw: resultado });
  } catch (err) {
    console.error('Erro ao gerar QR Code:', err.response?.data || err.message);
    res.status(500).json({ erro: 'Erro ao gerar QR Code', detalhe: err.response?.data || err.message });
  }
});

// POST /api/chips/:id/pairingcode - Gerar codigo de pareamento por numero
router.post('/:id/pairingcode', async (req, res, next) => {
  try {
    const chip = await prisma.chip.findFirst({
      where: { id: parseInt(req.params.id), contaId: req.usuario.contaId },
    });

    if (!chip) {
      return res.status(404).json({ erro: 'Chip nao encontrado' });
    }

    const { telefone } = req.body;
    if (!telefone) {
      return res.status(400).json({ erro: 'Telefone obrigatorio' });
    }

    const resultado = await evolutionApi.gerarPairingCode(chip.instanciaEvolution, telefone);
    console.log('[PairingCode] Resposta Evolution:', JSON.stringify(resultado));

    const code = resultado?.code || resultado?.pairingCode;
    res.json({ code, raw: resultado });
  } catch (err) {
    console.error('Erro ao gerar pairing code:', err.response?.data || err.message);
    res.status(500).json({ erro: 'Erro ao gerar codigo', detalhe: err.response?.data || err.message });
  }
});

// GET /api/chips/:id/status - Verificar status da conexao
router.get('/:id/status', async (req, res, next) => {
  try {
    const chip = await prisma.chip.findFirst({
      where: { id: parseInt(req.params.id), contaId: req.usuario.contaId },
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
    const chip = await prisma.chip.findFirst({
      where: { id: parseInt(req.params.id), contaId: req.usuario.contaId },
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

    // Verificar que o chip pertence à conta do usuário
    const chipParaDeletar = await prisma.chip.findFirst({ where: { id: chipId, contaId: req.usuario.contaId } });
    if (!chipParaDeletar) {
      return res.status(403).json({ erro: 'Chip não encontrado ou sem permissão' });
    }

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

    // Usar instancia do chip já buscado no início
    const instancia = chipParaDeletar?.instanciaEvolution;

    // Deletar chip
    await prisma.chip.delete({ where: { id: chipId } });

    // Tentar deletar instancia na Evolution API
    try {
      if (instancia) await evolutionApi.deletarInstancia(instancia);
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

    const chip = await prisma.chip.findFirst({ where: { id: chipId, contaId: req.usuario.contaId } });
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

// GET /api/chips/:id/etiquetas - Listar etiquetas WhatsApp Business do chip
router.get('/:id/etiquetas', async (req, res, next) => {
  try {
    const chip = await prisma.chip.findFirst({
      where: { id: parseInt(req.params.id), contaId: req.usuario.contaId },
    });
    if (!chip) return res.status(404).json({ erro: 'Chip nao encontrado' });
    const etiquetas = await evolutionApi.listarEtiquetas(chip.instanciaEvolution);
    res.json(etiquetas);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
