// Orquestrador: recebe imagem → analisa com IA → se for comprovante, registra venda
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { analisarImagem, analisarTextoPDF } = require('./claudeVision');
const { emitir } = require('./socketManager');
const { enviarTexto, enviarDocumento, aplicarEtiqueta } = require('./evolutionApi');
const { detectarPaisDeTelefone, PAISES, MSGS_CONFIRMACAO, MSGS_DIVERGENCIA, formatarMoedaLocal } = require('../utils/paises');

const prisma = new PrismaClient();

// Processa imagem recebida de um cliente (pode ou não ser comprovante)
async function processarComprovante({ clienteId, chipId, imagemPath, instanciaEvolution, telefoneCliente, textoPDF }) {
  console.log(`[Comprovante] Analisando imagem/documento para cliente ${clienteId}, chip ${chipId}`);

  // Dedup: verificar se mesma imagem já foi processada para este cliente
  let imageHash = null;
  if (!textoPDF && imagemPath) {
    try {
      const buffer = fs.readFileSync(imagemPath);
      imageHash = crypto.createHash('sha256').update(buffer).digest('hex');
      const duplicado = await prisma.$queryRaw`
        SELECT id FROM comprovantes
        WHERE cliente_id = ${clienteId}
        AND dados_brutos_ia IS NOT NULL
        AND dados_brutos_ia->>'image_hash' = ${imageHash}
        LIMIT 1
      `;
      if (duplicado.length > 0) {
        console.log('[Comprovante] Imagem duplicada detectada, ignorando');
        return { status: 'duplicado', descricao: 'Comprovante já processado anteriormente' };
      }
    } catch (e) {
      console.error('[Comprovante] Erro no dedup:', e.message);
    }
  }

  // Buscar chip para isolamento por conta
  const chip = await prisma.chip.findUnique({ where: { id: chipId } });
  const contaId = chip?.contaId || null;

  let comprovante = null;
  try {
    // Analisar com Claude Vision (imagem) ou texto (PDF)
    let dados;
    if (textoPDF) {
      dados = await analisarTextoPDF(textoPDF);
    } else {
      dados = await analisarImagem(imagemPath);
    }
    console.log('[Comprovante] Resultado da análise:', dados);

    // Se não é comprovante, apenas logar e sair
    if (!dados.eh_comprovante) {
      console.log(`[Comprovante] Imagem não é comprovante: ${dados.descricao || 'N/A'}`);
      return { status: 'nao_comprovante', descricao: dados.descricao };
    }

    console.log('[Comprovante] Comprovante detectado! Processando...');

    // Criar registro do comprovante
    comprovante = await prisma.comprovante.create({
      data: {
        clienteId,
        chipId,
        imagemPath: imagemPath || 'pdf',
        status: 'analisando',
      },
    });

    // Buscar venda pendente do cliente
    const vendaPendente = await prisma.venda.findFirst({
      where: {
        clienteId,
        status: 'pendente',
      },
      orderBy: { criadoEm: 'desc' },
    });

    let statusComprovante = 'confirmado';
    let statusVenda = 'confirmado';

    // Se há venda pendente, comparar valores
    if (vendaPendente && dados.valor) {
      const diferenca = Math.abs(vendaPendente.valor - dados.valor);
      const tolerancia = vendaPendente.valor * 0.02; // 2% de tolerância

      if (diferenca > tolerancia) {
        statusComprovante = 'divergente';
        statusVenda = 'pendente'; // Mantém pendente para verificação
        console.log(`[Comprovante] Valor divergente: esperado ${vendaPendente.valor}, recebido ${dados.valor}`);
      }
    }

    // Atualizar comprovante com dados extraídos
    await prisma.comprovante.update({
      where: { id: comprovante.id },
      data: {
        nomePagador: dados.nome_pagador,
        valorExtraido: dados.valor,
        dataPagamento: dados.data_pagamento,
        banco: dados.banco,
        tipoTransferencia: dados.tipo_transferencia,
        dadosBrutosIA: imageHash ? { ...dados, image_hash: imageHash } : dados,
        vendaId: vendaPendente?.id || null,
        status: statusComprovante,
      },
    });

    // Se confirmado, atualizar venda e lead
    if (statusComprovante === 'confirmado') {
      if (vendaPendente) {
        await prisma.venda.update({
          where: { id: vendaPendente.id },
          data: {
            status: 'confirmado',
            contaId: contaId || vendaPendente.contaId || 1,
            chipNome: chip?.nome || vendaPendente.chipNome || null,
          },
        });
      } else if (dados.valor) {
        // Criar venda automaticamente se não existe pendente
        await prisma.venda.create({
          data: {
            clienteId,
            chipId,
            contaId: contaId || 1,
            chipNome: chip?.nome || null,
            valor: dados.valor,
            status: 'confirmado',
            descricao: `Pagamento confirmado via comprovante - ${dados.banco || 'N/A'}`,
          },
        });
      }

      // Atualizar status do lead para "comprou"
      await prisma.cliente.update({
        where: { id: clienteId },
        data: { status: 'comprou' },
      });

      // Buscar configurações da conta
      const configsConta = await prisma.configuracao.findMany({
        where: { chave: { in: ['msg_pagamento_confirmado', 'etiqueta_pagamento_ativa', 'etiqueta_pagamento_id', 'confirmacao_pdf_ativo', 'confirmacao_pdf_url', 'confirmacao_pdfs', 'upsells'] }, contaId },
      }).catch(() => []);
      const cfgMap = Object.fromEntries(configsConta.map(c => [c.chave, c.valor]));

      // Carregar configs múltiplas de confirmação (novo formato)
      const cfgConfigs = await prisma.configuracao.findFirst({
        where: { chave: 'confirmacao_configs', contaId },
      }).catch(() => null);
      let confirmacaoConfigs = [];
      if (cfgConfigs?.valor) {
        try { confirmacaoConfigs = JSON.parse(cfgConfigs.valor); } catch {}
      }

      // Encontrar configs que se aplicam a este chip (chipIds vazio = todos)
      const chipIdStr = chipId?.toString();
      const configsAplicaveis = confirmacaoConfigs.filter(c =>
        !c.chipIds?.length || c.chipIds.includes(chipIdStr)
      );

      const { mensagemQueue } = require('../queues/setup');
      const paisCliente = detectarPaisDeTelefone(telefoneCliente);
      const valorStr = dados.valor ? formatarMoedaLocal(dados.valor, paisCliente) : 'N/A';

      // Meta Conversions API
      try {
        const cfgMeta = await prisma.configuracao.findMany({
          where: { chave: { in: ['eventos_meta_ativo', 'eventos_meta_pixel_id', 'eventos_meta_token'] }, contaId },
        }).catch(() => []);
        const metaMap = Object.fromEntries(cfgMeta.map(c => [c.chave, c.valor]));
        if (metaMap.eventos_meta_ativo === 'true' && metaMap.eventos_meta_pixel_id && metaMap.eventos_meta_token && dados.valor) {
          const { dispararPurchaseMeta } = require('./metaConversions');
          await dispararPurchaseMeta({
            pixelId: metaMap.eventos_meta_pixel_id,
            accessToken: metaMap.eventos_meta_token,
            telefone: telefoneCliente,
            valor: dados.valor,
          });
        }
      } catch (errMeta) {
        console.error('[Comprovante] Erro Meta Conversions:', errMeta.message);
      }

      // Push notification
      try {
        const { io } = require('./socketManager');
        const valorFormatado = dados.valor ? formatarMoedaLocal(dados.valor, paisCliente) : null;
        if (io) io.emit('venda:confirmada', { valor: dados.valor, valorFormatado, contaId });
        const { enviarPushParaTodos } = require('../routes/push');
        enviarPushParaTodos({
          title: `💰 ${valorFormatado || `R$ ${dados.valor}`} — Venda Confirmada!`,
          body: 'Comprovante aprovado',
          tag: 'venda',
        });
      } catch (_) {}

      if (configsAplicaveis.length > 0) {
        // Novo formato: múltiplas configs por chip
        for (const cfg of configsAplicaveis) {
          // Chips a usar: lista selecionada ou o chip que recebeu o comprovante
          const chipIdsAlvo = cfg.chipIds?.length > 0 ? cfg.chipIds : [chipId?.toString()];
          const chipsAlvo = await prisma.chip.findMany({
            where: { id: { in: chipIdsAlvo.map(id => parseInt(id)) }, contaId },
          }).catch(() => []);
          const instancias = chipsAlvo.length > 0 ? chipsAlvo.map(c => c.instanciaEvolution) : [instanciaEvolution];

          for (const instancia of instancias) {

          // Mensagem de confirmação
          if (cfg.msg) {
            const msg = cfg.msg.replace('{valor}', valorStr);
            const msgDelayMs = (parseInt(cfg.msg_delay) || 0) * 1000;
            if (msgDelayMs > 0) {
              await mensagemQueue.add({ tipo: 'texto', instancia, telefone: telefoneCliente, mensagem: msg }, { delay: msgDelayMs });
            } else {
              try {
                await enviarTexto(instancia, telefoneCliente, msg);
                const conv = await prisma.conversa.create({ data: { clienteId, chipId, tipo: 'enviada', conteudo: msg, status: 'enviado' } });
                emitir('mensagem:nova', { conversa: conv, clienteId, chipId }, contaId);
              } catch (err) { console.error('[Comprovante] Erro ao enviar msg:', err.message); }
            }
          }

          // PDFs
          if (cfg.pdf_ativo && cfg.pdfs?.length > 0) {
            const pdfDelayMs = (parseInt(cfg.pdf_delay) || 0) * 1000;
            for (let i = 0; i < cfg.pdfs.length; i++) {
              const pdf = cfg.pdfs[i];
              const delay = pdfDelayMs + (i * 2000);
              if (delay > 0) {
                await mensagemQueue.add({ tipo: 'documento', instancia, telefone: telefoneCliente, url: pdf.url, nomeArquivo: pdf.nome || 'confirmacao.pdf' }, { delay });
              } else {
                try {
                  await enviarDocumento(instancia, telefoneCliente, pdf.url, pdf.nome || 'confirmacao.pdf');
                  console.log('[Comprovante] PDF enviado:', pdf.nome);
                } catch (err) { console.error('[Comprovante] Erro ao enviar PDF:', err.message); }
              }
            }
          }
          } // fim for instancias
        }
      } else {
        // Fallback: formato legado
        let msgConfirmacao;
        if (cfgMap.msg_pagamento_confirmado) {
          msgConfirmacao = cfgMap.msg_pagamento_confirmado.replace('{valor}', valorStr);
        } else {
          const idiomaCliente = PAISES[paisCliente]?.idioma || 'pt';
          const msgFn = MSGS_CONFIRMACAO[idiomaCliente] || MSGS_CONFIRMACAO['pt'];
          msgConfirmacao = msgFn(valorStr);
        }
        try {
          await enviarTexto(instanciaEvolution, telefoneCliente, msgConfirmacao);
          const conv = await prisma.conversa.create({ data: { clienteId, chipId, tipo: 'enviada', conteudo: msgConfirmacao, status: 'enviado' } });
          emitir('mensagem:nova', { conversa: conv, clienteId, chipId }, contaId);
        } catch (err) { console.error('[Comprovante] Erro ao enviar confirmação:', err.message); }

        if (cfgMap.confirmacao_pdf_ativo === 'true') {
          let listaPdfs = [];
          if (cfgMap.confirmacao_pdfs) {
            try { listaPdfs = JSON.parse(cfgMap.confirmacao_pdfs); } catch {}
          } else if (cfgMap.confirmacao_pdf_url) {
            listaPdfs = [{ url: cfgMap.confirmacao_pdf_url, nome: 'confirmacao.pdf' }];
          }
          for (const pdf of listaPdfs) {
            try {
              await enviarDocumento(instanciaEvolution, telefoneCliente, pdf.url, pdf.nome || 'confirmacao.pdf');
            } catch (err) { console.error('[Comprovante] Erro ao enviar PDF:', err.message); }
          }
        }
      }

      // Aplicar etiqueta em todos os chips ativos da conta
      if (cfgMap.etiqueta_pagamento_ativa === 'true' && cfgMap.etiqueta_pagamento_id) {
        const chipsAtivos = await prisma.chip.findMany({ where: { contaId, ativo: true } });
        for (const c of chipsAtivos) {
          try {
            await aplicarEtiqueta(c.instanciaEvolution, telefoneCliente, cfgMap.etiqueta_pagamento_id);
            console.log(`[Comprovante] Etiqueta ${cfgMap.etiqueta_pagamento_id} aplicada em ${c.instanciaEvolution}`);
          } catch (err) {
            console.error(`[Comprovante] Erro ao aplicar etiqueta no chip ${c.instanciaEvolution}:`, err.message);
          }
        }
      }
      // Agendar upsells automáticos
      if (cfgMap.upsells) {
        try {
          const upsells = JSON.parse(cfgMap.upsells);
          const { mensagemQueue } = require('../queues/setup');
          for (const up of upsells) {
            if (!up.ativo) continue;
            // Filtro por chip: vazio = todos, senão só os selecionados
            if (up.chipIds?.length > 0 && !up.chipIds.includes(chipId)) continue;
            const tempoMs = parseInt(up.tempo || '30') * (up.unidade === 'horas' ? 3600000 : 60000);
            let acumulado = tempoMs;
            for (let i = 0; i < (up.blocos || []).length; i++) {
              const bloco = up.blocos[i];
              if (bloco.tipo === 'delay') {
                const mult = bloco.unidade === 'horas' ? 3600000 : bloco.unidade === 'segundos' ? 1000 : 60000;
                acumulado += parseInt(bloco.valor || '1') * mult;
                continue;
              }
              const delay = acumulado + (i * 3000);
              if (bloco.tipo === 'texto' && bloco.valor)
                await mensagemQueue.add({ tipo: 'texto', instancia: instanciaEvolution, telefone: telefoneCliente, mensagem: bloco.valor }, { delay });
              else if (bloco.tipo === 'video' && bloco.valor)
                await mensagemQueue.add({ tipo: 'video', instancia: instanciaEvolution, telefone: telefoneCliente, url: bloco.valor, legenda: '' }, { delay });
              else if (bloco.tipo === 'imagem' && bloco.valor)
                await mensagemQueue.add({ tipo: 'imagem', instancia: instanciaEvolution, telefone: telefoneCliente, url: bloco.valor, legenda: '' }, { delay });
              else if (bloco.tipo === 'audio' && bloco.valor)
                await mensagemQueue.add({ tipo: 'audio', instancia: instanciaEvolution, telefone: telefoneCliente, url: bloco.valor }, { delay });
              else if (bloco.tipo === 'pdf' && bloco.valor)
                await mensagemQueue.add({ tipo: 'documento', instancia: instanciaEvolution, telefone: telefoneCliente, url: bloco.valor, nomeArquivo: 'upsell.pdf' }, { delay });
            }
            console.log(`[Comprovante] Upsell "${up.nome}" agendado: ${up.blocos?.length || 0} blocos`);
          }
        } catch (err) {
          console.error('[Comprovante] Erro ao processar upsells:', err.message);
        }
      }
    } else {
      // Avisar cliente sobre divergência no idioma correto
      const paisClienteDiv = detectarPaisDeTelefone(telefoneCliente);
      const idiomaClienteDiv = PAISES[paisClienteDiv]?.idioma || 'pt';
      const valorDivStr = dados.valor ? formatarMoedaLocal(dados.valor, paisClienteDiv) : 'N/A';
      const msgDivFn = MSGS_DIVERGENCIA[idiomaClienteDiv] || MSGS_DIVERGENCIA['pt'];
      const msgDivergencia = msgDivFn(valorDivStr);
      try {
        await enviarTexto(instanciaEvolution, telefoneCliente, msgDivergencia);
        const conversaDiv = await prisma.conversa.create({
          data: { clienteId, chipId, tipo: 'enviada', conteudo: msgDivergencia, status: 'enviado' },
        });
        emitir('mensagem:nova', { conversa: conversaDiv, clienteId, chipId }, contaId);
      } catch {}
      console.log('[Comprovante] Divergência detectada - alertando operador');
    }

    // Emitir evento via WebSocket
    emitir('comprovante:analisado', {
      comprovanteId: comprovante.id,
      clienteId,
      status: statusComprovante,
      dados,
    }, contaId);

    return { status: statusComprovante, dados };
  } catch (err) {
    console.error('[Comprovante] Erro na análise:', err.message);

    if (comprovante) {
      await prisma.comprovante.update({
        where: { id: comprovante.id },
        data: { status: 'divergente', dadosBrutosIA: { erro: err.message } },
      }).catch(() => {});
      emitir('comprovante:analisado', {
        comprovanteId: comprovante.id,
        clienteId,
        status: 'divergente',
        erro: err.message,
      }, contaId);
    }

    return { status: 'divergente', erro: err.message };
  }
}

module.exports = { processarComprovante };
