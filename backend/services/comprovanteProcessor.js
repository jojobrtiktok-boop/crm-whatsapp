// Orquestrador: recebe imagem → analisa com IA → se for comprovante, registra venda
const { PrismaClient } = require('@prisma/client');
const { analisarImagem, analisarTextoPDF } = require('./claudeVision');
const { emitir } = require('./socketManager');
const { enviarTexto } = require('./evolutionApi');
const { detectarPaisDeTelefone, PAISES, MSGS_CONFIRMACAO, MSGS_DIVERGENCIA, formatarMoedaLocal } = require('../utils/paises');

const prisma = new PrismaClient();

// Processa imagem recebida de um cliente (pode ou não ser comprovante)
async function processarComprovante({ clienteId, chipId, imagemPath, instanciaEvolution, telefoneCliente, textoPDF }) {
  console.log(`[Comprovante] Analisando imagem/documento para cliente ${clienteId}, chip ${chipId}`);

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
        dadosBrutosIA: dados,
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

      // Enviar mensagem de confirmação no idioma do cliente
      const paisCliente = detectarPaisDeTelefone(telefoneCliente);
      const idiomaCliente = PAISES[paisCliente]?.idioma || 'pt';
      const valorStr = dados.valor ? formatarMoedaLocal(dados.valor, paisCliente) : 'N/A';
      const msgFn = MSGS_CONFIRMACAO[idiomaCliente] || MSGS_CONFIRMACAO['pt'];
      const msgConfirmacao = msgFn(valorStr);
      try {
        const chip = await prisma.chip.findUnique({ where: { id: chipId } });
        await enviarTexto(instanciaEvolution, telefoneCliente, msgConfirmacao);
        // Salvar mensagem de confirmação no histórico
        const conversaConf = await prisma.conversa.create({
          data: { clienteId, chipId, tipo: 'enviada', conteudo: msgConfirmacao, status: 'enviado' },
        });
        emitir('mensagem:nova', { conversa: conversaConf, clienteId, chipId });
      } catch (err) {
        console.error('[Comprovante] Erro ao enviar confirmação:', err.message);
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
        emitir('mensagem:nova', { conversa: conversaDiv, clienteId, chipId });
      } catch {}
      console.log('[Comprovante] Divergência detectada - alertando operador');
    }

    // Emitir evento via WebSocket
    emitir('comprovante:analisado', {
      comprovanteId: comprovante.id,
      clienteId,
      status: statusComprovante,
      dados,
    });

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
      });
    }

    return { status: 'divergente', erro: err.message };
  }
}

module.exports = { processarComprovante };
