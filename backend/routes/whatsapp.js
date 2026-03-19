// Rotas de envio de mensagens WhatsApp
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');
const { enviarTexto, enviarImagem, verificarStatus } = require('../services/evolutionApi');
const { mensagemQueue } = require('../queues/setup');

const prisma = new PrismaClient();

router.use(autenticar);

// POST /api/whatsapp/enviar - Enviar mensagem manualmente
router.post('/enviar', async (req, res, next) => {
  try {
    const { clienteId, chipId, mensagem, tipo = 'texto' } = req.body;

    if (!clienteId || !chipId || !mensagem) {
      return res.status(400).json({ erro: 'Cliente, chip e mensagem são obrigatórios' });
    }

    const [cliente, chip] = await Promise.all([
      prisma.cliente.findUnique({ where: { id: parseInt(clienteId) } }),
      prisma.chip.findUnique({ where: { id: parseInt(chipId) } }),
    ]);

    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });
    if (!chip) return res.status(404).json({ erro: 'Chip não encontrado' });

    // Adicionar à fila com prioridade alta (atendimento humano)
    await mensagemQueue.add(
      {
        tipo,
        instancia: chip.instanciaEvolution,
        telefone: cliente.telefone,
        mensagem,
      },
      { priority: 1 } // Prioridade alta
    );

    // Salvar conversa como enviada
    const conversa = await prisma.conversa.create({
      data: {
        clienteId: cliente.id,
        chipId: chip.id,
        tipo: 'enviada',
        conteudo: mensagem,
      },
    });

    res.json({ mensagem: 'Mensagem enfileirada para envio', conversa });
  } catch (err) {
    next(err);
  }
});

// GET /api/whatsapp/status/:chipId - Status da conexão do chip
router.get('/status/:chipId', async (req, res, next) => {
  try {
    const chip = await prisma.chip.findUnique({
      where: { id: parseInt(req.params.chipId) },
    });

    if (!chip) return res.status(404).json({ erro: 'Chip não encontrado' });

    const status = await verificarStatus(chip.instanciaEvolution);
    res.json({ chip: chip.nome, status });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
