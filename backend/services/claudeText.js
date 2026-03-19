// Serviço de variação humanizada de mensagens com Claude
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// Reescreve mensagem mantendo o objetivo mas com palavras diferentes
async function variarMensagem(mensagemBase, tom, contexto, nomeCliente) {
  const tons = {
    formal: 'Use linguagem formal e profissional.',
    informal: 'Use linguagem informal e descontraída, como se fosse um amigo.',
    vendedor: 'Use técnicas de copywriting e persuasão, seja entusiasta.',
    empatico: 'Seja empático e acolhedor, mostre que se importa com a pessoa.',
  };

  const instrucaoTom = tons[tom] || tons.informal;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Reescreva a mensagem abaixo de forma COMPLETAMENTE DIFERENTE, mantendo o mesmo objetivo e informações. Use palavras, estrutura e estilo diferentes.

${instrucaoTom}

${contexto ? `Contexto do produto/serviço: ${contexto}` : ''}
${nomeCliente ? `Nome do cliente: ${nomeCliente}` : ''}

Mensagem original:
"${mensagemBase}"

Regras:
- NÃO copie frases da mensagem original
- Use estrutura de frase diferente
- Mantenha o mesmo tom e objetivo
- Se houver {nome} na mensagem, substitua pelo nome do cliente
- A mensagem deve parecer natural, como se fosse escrita por uma pessoa real
- NÃO use emojis em excesso
- Retorne APENAS a mensagem reescrita, sem explicações`,
      },
    ],
  });

  return response.content[0].text.trim();
}

module.exports = { variarMensagem };
