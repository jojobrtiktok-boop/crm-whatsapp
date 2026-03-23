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
          data: { status: 'confirmado' },
        });
      } else if (dados.valor) {
        // Criar venda automaticamente se não existe pendente
        await prisma.venda.create({
          data: {
            clienteId,
            chipId,
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

      // Buscar configurações da conta para mensagem personalizada, PDF, etiqueta e upsell
      const configsConta = await prisma.configuracao.findMany({
        where: { chave: { in: ['msg_pagamento_confirmado', 'etiqueta_pagamento_ativa', 'etiqueta_pagamento_id', 'confirmacao_pdf_ativo', 'confirmacao_pdf_url', 'upsell_ativo', 'upsell_tempo', 'upsell_unidade', 'upsell_blocos'] }, contaId },
      }).catch(() => []);
      const cfgMap = Object.fromEntries(configsConta.map(c => [c.chave, c.valor]));

      // Montar mensagem de confirmação (personalizada ou padrão por idioma)
      let msgConfirmacao;
      if (cfgMap.msg_pagamento_confirmado) {
        const valorStr = dados.valor ? formatarMoedaLocal(dados.valor, detectarPaisDeTelefone(telefoneCliente)) : 'N/A';
        msgConfirmacao = cfgMap.msg_pagamento_confirmado.replace('{valor}', valorStr);
      } else {
        const paisCliente = detectarPaisDeTelefone(telefoneCliente);
        const idiomaCliente = PAISES[paisCliente]?.idioma || 'pt';
        const valorStr = dados.valor ? formatarMoedaLocal(dados.valor, paisCliente) : 'N/A';
        const msgFn = MSGS_CONFIRMACAO[idiomaCliente] || MSGS_CONFIRMACAO['pt'];
        msgConfirmacao = msgFn(valorStr);
      }

      try {
        await enviarTexto(instanciaEvolution, telefoneCliente, msgConfirmacao);
        // Salvar mensagem de confirmação no histórico
        const conversaConf = await prisma.conversa.create({
          data: { clienteId, chipId, tipo: 'enviada', conteudo: msgConfirmacao, status: 'enviado' },
        });
        emitir('mensagem:nova', { conversa: conversaConf, clienteId, chipId }, contaId);
      } catch (err) {
        console.error('[Comprovante] Erro ao enviar confirmação:', err.message);
      }

      // Enviar PDF junto com a confirmação, se configurado
      if (cfgMap.confirmacao_pdf_ativo === 'true' && cfgMap.confirmacao_pdf_url) {
        try {
          await enviarDocumento(instanciaEvolution, telefoneCliente, cfgMap.confirmacao_pdf_url, 'confirmacao.pdf');
          console.log('[Comprovante] PDF de confirmação enviado');
        } catch (err) {
          console.error('[Comprovante] Erro ao enviar PDF:', err.message);
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
      // Agendar upsell automático com delay, se configurado
      if (cfgMap.upsell_ativo === 'true' && cfgMap.upsell_blocos) {
        try {
          const blocos = JSON.parse(cfgMap.upsell_blocos);
          const tempoMs = parseInt(cfgMap.upsell_tempo || '30') * (cfgMap.upsell_unidade === 'horas' ? 3600000 : 60000);
          const { mensagemQueue } = require('../queues/setup');
          for (let i = 0; i < blocos.length; i++) {
            const bloco = blocos[i];
            const delay = tempoMs + (i * 3000);
            if (bloco.tipo === 'texto' && bloco.valor) {
              await mensagemQueue.add({ tipo: 'texto', instancia: instanciaEvolution, telefone: telefoneCliente, mensagem: bloco.valor }, { delay });
            } else if (bloco.tipo === 'video' && bloco.valor) {
              await mensagemQueue.add({ tipo: 'video', instancia: instanciaEvolution, telefone: telefoneCliente, url: bloco.valor, legenda: '' }, { delay });
            }
          }
          console.log(`[Comprovante] Upsell agendado: ${blocos.length} blocos em ${cfgMap.upsell_tempo} ${cfgMap.upsell_unidade}`);
        } catch (err) {
          console.error('[Comprovante] Erro ao agendar upsell:', err.message);
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
