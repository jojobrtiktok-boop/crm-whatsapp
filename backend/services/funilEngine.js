// Motor de execução dos funis de automação
const { PrismaClient } = require('@prisma/client');
const { mensagemQueue } = require('../queues/setup');
const { variarMensagem } = require('./claudeText');
const { emitir } = require('./socketManager');

const prisma = new PrismaClient();

// Inicia um funil para um lead
async function iniciarFunil(clienteId, chipId) {
  // Buscar funil ativo
  const funil = await prisma.funil.findFirst({
    where: { ativo: true },
    orderBy: { criadoEm: 'asc' },
  });

  if (!funil) {
    console.log('[Funil] Nenhum funil ativo encontrado');
    return null;
  }

  const blocos = funil.blocos;
  if (!blocos || blocos.length === 0) {
    console.log('[Funil] Funil sem blocos');
    return null;
  }

  // Encontrar bloco inicial (primeiro bloco que não é alvo de nenhuma conexão,
  // ou simplesmente o primeiro bloco)
  const conexoes = funil.conexoes || [];
  const alvos = new Set(conexoes.map((c) => c.target));
  const blocoInicial = blocos.find((b) => !alvos.has(b.id)) || blocos[0];

  // Criar execução do funil
  const execucao = await prisma.funilExecucao.create({
    data: {
      funilId: funil.id,
      clienteId,
      chipId,
      blocoAtualId: blocoInicial.id,
      status: 'ativo',
      dados: {},
    },
  });

  console.log(`[Funil] Iniciado funil "${funil.nome}" para cliente ${clienteId}, bloco: ${blocoInicial.id}`);

  // Executar bloco inicial
  await executarBloco(execucao.id, blocoInicial, funil);

  return execucao;
}

// Executa um bloco específico do funil
async function executarBloco(execucaoId, bloco, funil) {
  const execucao = await prisma.funilExecucao.findUnique({
    where: { id: execucaoId },
    include: { cliente: true, chip: true },
  });

  if (!execucao || execucao.status !== 'ativo') return;

  const { cliente, chip } = execucao;
  console.log(`[Funil] Executando bloco "${bloco.type}" (${bloco.id}) para ${cliente.telefone}`);

  switch (bloco.type) {
    case 'texto': {
      const msg = bloco.data.mensagem.replace('{nome}', cliente.nome || 'amigo');
      await agendarMensagem(chip.instanciaEvolution, cliente.telefone, msg, execucaoId);
      await avancarParaProximoBloco(execucaoId, bloco.id, funil);
      break;
    }

    case 'imagem': {
      await mensagemQueue.add({
        tipo: 'imagem',
        instancia: chip.instanciaEvolution,
        telefone: cliente.telefone,
        url: bloco.data.url,
        legenda: bloco.data.legenda || '',
        execucaoId,
      });
      await avancarParaProximoBloco(execucaoId, bloco.id, funil);
      break;
    }

    case 'audio': {
      await mensagemQueue.add({
        tipo: 'audio',
        instancia: chip.instanciaEvolution,
        telefone: cliente.telefone,
        url: bloco.data.url,
        execucaoId,
      });
      await avancarParaProximoBloco(execucaoId, bloco.id, funil);
      break;
    }

    case 'video': {
      await mensagemQueue.add({
        tipo: 'video',
        instancia: chip.instanciaEvolution,
        telefone: cliente.telefone,
        url: bloco.data.url,
        legenda: bloco.data.legenda || '',
        execucaoId,
      });
      await avancarParaProximoBloco(execucaoId, bloco.id, funil);
      break;
    }

    case 'botoes': {
      const msg = bloco.data.mensagem.replace('{nome}', cliente.nome || 'amigo');
      // Enviar mensagem com opções listadas como texto
      const opcoes = bloco.data.opcoes.map((o, i) => `${i + 1}. ${o.texto}`).join('\n');
      const msgCompleta = `${msg}\n\n${opcoes}`;
      await agendarMensagem(chip.instanciaEvolution, cliente.telefone, msgCompleta, execucaoId);
      // Não avança - aguarda resposta do lead
      break;
    }

    case 'delay': {
      const { tempo, unidade } = bloco.data;
      let delayMs = tempo * 60 * 1000; // Padrão: minutos
      if (unidade === 'horas') delayMs = tempo * 60 * 60 * 1000;
      if (unidade === 'segundos') delayMs = tempo * 1000;

      await mensagemQueue.add(
        { tipo: 'delay', execucaoId, blocoId: bloco.id },
        { delay: delayMs }
      );
      break;
    }

    case 'condicao': {
      // Condição é processada quando a resposta chega
      // Não faz nada aqui - aguarda resposta
      break;
    }

    case 'ia': {
      const { mensagemBase, tom, contexto } = bloco.data;
      try {
        const msgVariada = await variarMensagem(mensagemBase, tom, contexto, cliente.nome);
        await agendarMensagem(chip.instanciaEvolution, cliente.telefone, msgVariada, execucaoId);
      } catch (err) {
        console.error('[Funil] Erro na variação IA:', err.message);
        // Fallback: enviar mensagem original
        const msg = mensagemBase.replace('{nome}', cliente.nome || 'amigo');
        await agendarMensagem(chip.instanciaEvolution, cliente.telefone, msg, execucaoId);
      }
      await avancarParaProximoBloco(execucaoId, bloco.id, funil);
      break;
    }

    case 'comprovante': {
      // Aguarda envio de imagem - processado no webhook
      const msg = bloco.data.mensagem || 'Envie o comprovante de pagamento para confirmarmos.';
      await agendarMensagem(chip.instanciaEvolution, cliente.telefone, msg, execucaoId);
      break;
    }

    case 'tag': {
      // Adicionar tag ao lead
      if (bloco.data.tagId) {
        await prisma.clienteTag.upsert({
          where: { clienteId_tagId: { clienteId: cliente.id, tagId: bloco.data.tagId } },
          update: {},
          create: { clienteId: cliente.id, tagId: bloco.data.tagId },
        });
      }
      await avancarParaProximoBloco(execucaoId, bloco.id, funil);
      break;
    }

    case 'transferencia': {
      const msg = bloco.data.mensagem || 'Você será transferido para um atendente. Aguarde!';
      await agendarMensagem(chip.instanciaEvolution, cliente.telefone, msg, execucaoId);

      // Criar atendimento
      const atendimento = await prisma.atendimento.create({
        data: { clienteId: cliente.id },
        include: { cliente: { select: { id: true, nome: true, telefone: true } } },
      });

      // Pausar execução do funil
      await prisma.funilExecucao.update({
        where: { id: execucaoId },
        data: { status: 'transferido' },
      });

      // Notificar operadores
      emitir('atendimento:novo', atendimento);
      break;
    }

    default:
      console.log(`[Funil] Tipo de bloco desconhecido: ${bloco.type}`);
      await avancarParaProximoBloco(execucaoId, bloco.id, funil);
  }
}

// Avança para o próximo bloco na sequência do funil
async function avancarParaProximoBloco(execucaoId, blocoAtualId, funil, sourceHandle) {
  const conexoes = funil.conexoes || [];

  // Encontrar conexão de saída do bloco atual
  let conexao;
  if (sourceHandle) {
    conexao = conexoes.find((c) => c.source === blocoAtualId && c.sourceHandle === sourceHandle);
  }
  if (!conexao) {
    conexao = conexoes.find((c) => c.source === blocoAtualId);
  }

  if (!conexao) {
    // Funil concluído - sem próximo bloco
    await prisma.funilExecucao.update({
      where: { id: execucaoId },
      data: { status: 'concluido' },
    });
    console.log(`[Funil] Execução ${execucaoId} concluída`);
    return;
  }

  const blocos = funil.blocos || [];
  const proximoBloco = blocos.find((b) => b.id === conexao.target);

  if (!proximoBloco) {
    console.log(`[Funil] Bloco alvo não encontrado: ${conexao.target}`);
    return;
  }

  // Atualizar bloco atual na execução
  await prisma.funilExecucao.update({
    where: { id: execucaoId },
    data: { blocoAtualId: proximoBloco.id },
  });

  // Executar próximo bloco
  await executarBloco(execucaoId, proximoBloco, funil);
}

// Processa resposta do lead dentro de um funil
async function processarRespostaFunil(clienteId, mensagem, tipoMidia) {
  // Buscar execução ativa do lead
  const execucao = await prisma.funilExecucao.findFirst({
    where: { clienteId, status: 'ativo' },
    include: { funil: true },
  });

  if (!execucao) return null;

  const funil = execucao.funil;
  const blocos = funil.blocos || [];
  const blocoAtual = blocos.find((b) => b.id === execucao.blocoAtualId);

  if (!blocoAtual) return null;

  // Processar conforme tipo do bloco que está aguardando resposta
  if (blocoAtual.type === 'botoes') {
    const opcoes = blocoAtual.data.opcoes || [];
    // Tentar encontrar opção pela resposta (número ou texto)
    const resposta = mensagem.trim();
    let opcaoSelecionada = opcoes.find((o) => o.texto.toLowerCase() === resposta.toLowerCase());

    if (!opcaoSelecionada) {
      const num = parseInt(resposta);
      if (num >= 1 && num <= opcoes.length) {
        opcaoSelecionada = opcoes[num - 1];
      }
    }

    if (opcaoSelecionada) {
      await avancarParaProximoBloco(execucao.id, blocoAtual.id, funil, opcaoSelecionada.id);
    }
    return execucao;
  }

  if (blocoAtual.type === 'condicao') {
    // Avaliar condição
    const { condicao, valorEsperado } = blocoAtual.data;
    let caminhoOk = false;

    if (condicao === 'contem') {
      caminhoOk = mensagem.toLowerCase().includes(valorEsperado.toLowerCase());
    } else if (condicao === 'igual') {
      caminhoOk = mensagem.trim().toLowerCase() === valorEsperado.toLowerCase();
    } else {
      caminhoOk = !!mensagem; // Qualquer resposta
    }

    const handle = caminhoOk ? 'sim' : 'nao';
    await avancarParaProximoBloco(execucao.id, blocoAtual.id, funil, handle);
    return execucao;
  }

  if (blocoAtual.type === 'comprovante' && tipoMidia === 'imagem') {
    // Comprovante será processado separadamente pelo comprovanteProcessor
    await avancarParaProximoBloco(execucao.id, blocoAtual.id, funil);
    return execucao;
  }

  return null;
}

// Agenda envio de mensagem na fila
async function agendarMensagem(instancia, telefone, mensagem, execucaoId) {
  await mensagemQueue.add({
    tipo: 'texto',
    instancia,
    telefone,
    mensagem,
    execucaoId,
  });
}

module.exports = { iniciarFunil, processarRespostaFunil, executarBloco, avancarParaProximoBloco };
