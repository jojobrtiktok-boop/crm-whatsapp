// Rotas de envio de mensagens WhatsApp
const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');
const { enviarTexto, verificarStatus } = require('../services/evolutionApi');
const { mensagemQueue } = require('../queues/setup');

const prisma = new PrismaClient();

// Config de upload para arquivos de atendimento
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'atendimento');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpg|jpeg|png|webp|gif|mp4|avi|mov|pdf/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Tipo não permitido. Use: imagem, vídeo ou PDF'));
  },
});

router.use(autenticar);

// POST /api/whatsapp/enviar - Enviar mensagem de texto manualmente
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

    // Salvar conversa primeiro para ter o ID
    const conversa = await prisma.conversa.create({
      data: {
        clienteId: cliente.id,
        chipId: chip.id,
        tipo: 'enviada',
        conteudo: mensagem,
        status: 'enviado',
      },
    });

    // Adicionar à fila com prioridade alta (atendimento humano)
    await mensagemQueue.add(
      {
        tipo,
        instancia: chip.instanciaEvolution,
        telefone: cliente.telefone,
        mensagem,
        conversaId: conversa.id,
      },
      { priority: 1 }
    );

    res.json({ mensagem: 'Mensagem enfileirada para envio', conversa });
  } catch (err) {
    next(err);
  }
});

// POST /api/whatsapp/enviar-arquivo - Enviar arquivo (imagem, vídeo, PDF)
router.post('/enviar-arquivo', upload.single('arquivo'), async (req, res, next) => {
  try {
    const { clienteId, chipId } = req.body;

    if (!clienteId || !chipId || !req.file) {
      return res.status(400).json({ erro: 'Cliente, chip e arquivo são obrigatórios' });
    }

    const [cliente, chip] = await Promise.all([
      prisma.cliente.findUnique({ where: { id: parseInt(clienteId) } }),
      prisma.chip.findUnique({ where: { id: parseInt(chipId) } }),
    ]);

    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });
    if (!chip) return res.status(404).json({ erro: 'Chip não encontrado' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const isPDF = ext === '.pdf';
    const isVideo = /\.(mp4|avi|mov)$/.test(ext);
    const tipoMidia = isPDF ? 'documento' : isVideo ? 'video' : 'imagem';

    // Caminho local do arquivo (enviado como base64 para o WAHA)
    const fileUrl = req.file.path;

    // Salvar conversa
    const conversa = await prisma.conversa.create({
      data: {
        clienteId: cliente.id,
        chipId: chip.id,
        tipo: 'enviada',
        conteudo: req.file.originalname,
        tipoMidia,
        midiaUrl: `/uploads/atendimento/${req.file.filename}`,
        status: 'enviado',
      },
    });

    // Enfileirar envio
    await mensagemQueue.add(
      {
        tipo: tipoMidia,
        instancia: chip.instanciaEvolution,
        telefone: cliente.telefone,
        url: fileUrl,
        legenda: '',
        nomeArquivo: req.file.originalname,
        conversaId: conversa.id,
      },
      { priority: 1 }
    );

    res.json({ conversa });
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
