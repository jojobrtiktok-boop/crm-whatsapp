// Serviço de análise de comprovantes com Claude Vision
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const config = require('../config');

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// Analisa imagem de comprovante e extrai dados
async function analisarComprovante(imagemPath) {
  // Ler imagem e converter para base64
  const imagemBuffer = fs.readFileSync(imagemPath);
  const imagemBase64 = imagemBuffer.toString('base64');

  // Detectar tipo MIME
  const extensao = imagemPath.split('.').pop().toLowerCase();
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  const mediaType = mimeTypes[extensao] || 'image/jpeg';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imagemBase64,
            },
          },
          {
            type: 'text',
            text: `Analise este comprovante de pagamento/transferência e extraia as seguintes informações em formato JSON:

{
  "nome_pagador": "nome de quem fez o pagamento",
  "valor": 0.00,
  "data_pagamento": "DD/MM/AAAA",
  "banco": "nome do banco",
  "tipo_transferencia": "PIX, TED, DOC, etc",
  "valido": true ou false (se parece ser um comprovante real)
}

Se não conseguir identificar algum campo, coloque null.
Retorne APENAS o JSON, sem texto adicional.`,
          },
        ],
      },
    ],
  });

  // Extrair JSON da resposta
  const textoResposta = response.content[0].text.trim();
  try {
    // Tentar parsear diretamente
    return JSON.parse(textoResposta);
  } catch {
    // Se falhar, tentar extrair JSON do texto
    const match = textoResposta.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Não foi possível extrair dados do comprovante');
  }
}

module.exports = { analisarComprovante };
