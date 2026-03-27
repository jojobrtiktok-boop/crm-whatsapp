// Rotas de disparo em massa para grupos WhatsApp
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');
const evolutionApi = require('../services/evolutionApi');
const { emitir } = require('../services/socketManager');
const { disparoQueue } = require('../queues/setup');

const prisma = new PrismaClient();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

router.use(autenticar);

// GET /api/disparo/grupos/:chipId - Listar grupos do chip
router.get('/grupos/:chipId', async (req, res, next) => {
  try {
    const chip = await prisma.chip.findFirst({
      where: { id: parseInt(req.params.chipId), contaId: req.usuario.contaId },
    });
    if (!chip) return res.status(404).json({ erro: 'Chip não encontrado' });

    const grupos = await evolutionApi.listarGrupos(chip.instanciaEvolution);
    res.json(grupos);
  } catch (err) {
    console.error('[Disparo] Erro ao listar grupos:', err.response?.data || err.message);
    res.status(500).json({ erro: 'Erro ao listar grupos. Verifique se o chip está conectado.' });
  }
});

// GET /api/disparo - Histórico de disparos da conta
router.get('/', async (req, res, next) => {
  try {
    const disparos = await prisma.disparo.findMany({
      where: { contaId: req.usuario.contaId },
      include: { chip: { select: { id: true, nome: true, numero: true } } },
      orderBy: { criadoEm: 'desc' },
      take: 100,
    });
    res.json(disparos);
  } catch (err) {
    next(err);
  }
});

// POST /api/disparo - Disparo imediato para grupos selecionados
router.post('/', async (req, res, next) => {
  try {
    const { nome, chipId, grupos, mensagem, delaySegundos = 20 } = req.body;

    if (!chipId || !grupos?.length || !mensagem?.trim()) {
      return res.status(400).json({ erro: 'chipId, grupos e mensagem são obrigatórios' });
    }

    const chip = await prisma.chip.findFirst({
      where: { id: parseInt(chipId), contaId: req.usuario.contaId },
    });
    if (!chip) return res.status(404).json({ erro: 'Chip não encontrado' });

    const disparo = await prisma.disparo.create({
      data: {
        nome: nome || `Disparo ${new Date().toLocaleDateString('pt-BR')}`,
        contaId: req.usuario.contaId,
        chipId: chip.id,
        grupos,
        mensagem,
        tipo: 'imediato',
        delaySegundos: parseInt(delaySegundos),
        totalEnvios: grupos.length,
        enviados: 0,
        status: 'enviando',
      },
    });

    // Executar envios em background para não bloquear a resposta
    res.json(disparo);

    for (const [i, grupo] of grupos.entries()) {
      try {
        await evolutionApi.enviarTexto(chip.instanciaEvolution, grupo.id, mensagem);
        await prisma.disparo.update({ where: { id: disparo.id }, data: { enviados: { increment: 1 } } });
        const atualizado = await prisma.disparo.findUnique({ where: { id: disparo.id } });
        emitir('disparo:progresso', { id: disparo.id, enviados: atualizado?.enviados || i + 1, total: grupos.length }, req.usuario.contaId);
      } catch (err) {
        console.error(`[Disparo] Erro ao enviar para ${grupo.id}:`, err.message);
      }
      if (i < grupos.length - 1) await sleep(parseInt(delaySegundos) * 1000);
    }

    const final = await prisma.disparo.findUnique({ where: { id: disparo.id } });
    const status = final?.enviados === grupos.length ? 'concluido' : 'erro_parcial';
    await prisma.disparo.update({ where: { id: disparo.id }, data: { status } });
    emitir('disparo:concluido', { id: disparo.id, status }, req.usuario.contaId);
  } catch (err) {
    next(err);
  }
});

// POST /api/disparo/agendar - Disparo agendado via planilha
router.post('/agendar', async (req, res, next) => {
  try {
    const { nome, chipId, grupos, linhas, delaySegundos = 20 } = req.body;

    if (!chipId || !grupos?.length || !linhas?.length) {
      return res.status(400).json({ erro: 'chipId, grupos e linhas são obrigatórios' });
    }

    const chip = await prisma.chip.findFirst({
      where: { id: parseInt(chipId), contaId: req.usuario.contaId },
    });
    if (!chip) return res.status(404).json({ erro: 'Chip não encontrado' });

    const totalEnvios = linhas.length * grupos.length;

    const disparo = await prisma.disparo.create({
      data: {
        nome: nome || `Planilha ${new Date().toLocaleDateString('pt-BR')}`,
        contaId: req.usuario.contaId,
        chipId: chip.id,
        grupos,
        mensagem: null,
        linhasPlanilha: linhas,
        tipo: 'agendado',
        delaySegundos: parseInt(delaySegundos),
        totalEnvios,
        enviados: 0,
        status: 'agendado',
      },
    });

    // Agendar jobs Bull com delay calculado até o horário de cada linha
    for (const linha of linhas) {
      const [h, m] = (linha.horario || '00:00').split(':');
      const target = new Date();
      target.setHours(parseInt(h), parseInt(m), 0, 0);
      // Se o horário já passou hoje, agendar para amanhã
      if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
      const baseMs = target.getTime() - Date.now();

      for (const [gi, grupo] of grupos.entries()) {
        const delayMs = baseMs + gi * parseInt(delaySegundos) * 1000;
        await disparoQueue.add({
          instancia: chip.instanciaEvolution,
          grupoId: grupo.id,
          mensagem: linha.mensagem,
          disparoId: disparo.id,
          contaId: req.usuario.contaId,
        }, { delay: delayMs });
      }
    }

    res.json({ ...disparo, jobsAgendados: totalEnvios });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/disparo/:id - Remover registro do histórico
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const disparo = await prisma.disparo.findFirst({ where: { id, contaId: req.usuario.contaId } });
    if (!disparo) return res.status(404).json({ erro: 'Disparo não encontrado' });

    await prisma.disparo.delete({ where: { id } });
    res.json({ mensagem: 'Removido com sucesso' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
