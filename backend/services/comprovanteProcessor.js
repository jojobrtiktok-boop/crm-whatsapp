// Orquestrador: recebe imagem de comprovante → analisa → registra venda
const { PrismaClient } = require('@prisma/client');
const { analisarComprovante } = require('./claudeVision');
const { emitir } = require('./socketManager');
const { enviarTexto } = require('./evolutionApi');

const prisma = new PrismaClient();

// Processa comprovante recebido de um cliente
async function processarComprovante({ clienteId, chipId, imagemPath, instanciaEvolution, telefoneCliente }) {
  console.log(`[Comprovante] Processando para cliente ${clienteId}, chip ${chipId}`);

  // Criar registro do comprovante como "analisando"
  const comprovante = await prisma.comprovante.create({
    data: {
      clienteId,
      chipId,
      imagemPath,
      status: 'analisando',
    },
  });

  try {
    // Analisar imagem com Claude Vision
    const dados = await analisarComprovante(imagemPath);
    console.log('[Comprovante] Dados extraídos:', dados);

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

      // Enviar mensagem de confirmação
      const msgConfirmacao = `Pagamento confirmado! ✅\nValor: R$ ${dados.valor?.toFixed(2) || 'N/A'}\nObrigado pela compra!`;
      try {
        await enviarTexto(instanciaEvolution, telefoneCliente, msgConfirmacao);
      } catch (err) {
        console.error('[Comprovante] Erro ao enviar confirmação:', err.message);
      }
    } else {
      // Alertar operador sobre divergência
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

    // Marcar como divergente em caso de erro
    await prisma.comprovante.update({
      where: { id: comprovante.id },
      data: { status: 'divergente', dadosBrutosIA: { erro: err.message } },
    });

    emitir('comprovante:analisado', {
      comprovanteId: comprovante.id,
      clienteId,
      status: 'divergente',
      erro: err.message,
    });

    return { status: 'divergente', erro: err.message };
  }
}

module.exports = { processarComprovante };
