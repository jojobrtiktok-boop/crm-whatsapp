// Seed - Dados iniciais para desenvolvimento
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed do banco de dados...');

  // Criar usuário admin padrão
  const senhaHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@crm.com' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@crm.com',
      senha: senhaHash,
      role: 'admin',
    },
  });
  console.log(`Usuário admin criado: ${admin.email}`);

  // Criar chips de exemplo
  const chip1 = await prisma.chip.create({
    data: {
      nome: 'Chip 5023',
      numero: '5511999995023',
      instanciaEvolution: 'chip-5023',
    },
  });
  const chip2 = await prisma.chip.create({
    data: {
      nome: 'Chip 6023',
      numero: '5511999996023',
      instanciaEvolution: 'chip-6023',
    },
  });
  console.log(`Chips criados: ${chip1.nome}, ${chip2.nome}`);

  // Criar tags de exemplo
  const tags = await Promise.all([
    prisma.tag.create({ data: { nome: 'VIP', cor: '#F59E0B' } }),
    prisma.tag.create({ data: { nome: 'Interessado', cor: '#3B82F6' } }),
    prisma.tag.create({ data: { nome: 'Recorrente', cor: '#10B981' } }),
    prisma.tag.create({ data: { nome: 'Inadimplente', cor: '#EF4444' } }),
  ]);
  console.log(`Tags criadas: ${tags.map(t => t.nome).join(', ')}`);

  // Criar clientes de exemplo
  const clientes = await Promise.all([
    prisma.cliente.create({
      data: {
        nome: 'João Silva',
        telefone: '5511999990001',
        chipOrigemId: chip1.id,
        status: 'comprou',
      },
    }),
    prisma.cliente.create({
      data: {
        nome: 'Maria Santos',
        telefone: '5511999990002',
        chipOrigemId: chip1.id,
        status: 'negociando',
      },
    }),
    prisma.cliente.create({
      data: {
        nome: 'Carlos Oliveira',
        telefone: '5511999990003',
        chipOrigemId: chip2.id,
        status: 'novo',
      },
    }),
    prisma.cliente.create({
      data: {
        nome: 'Ana Costa',
        telefone: '5511999990004',
        chipOrigemId: chip2.id,
        status: 'engajado',
      },
    }),
    prisma.cliente.create({
      data: {
        nome: 'Pedro Ferreira',
        telefone: '5511999990005',
        chipOrigemId: chip1.id,
        status: 'perdido',
      },
    }),
  ]);
  console.log(`Clientes criados: ${clientes.length}`);

  // Vincular tags aos clientes
  await prisma.clienteTag.createMany({
    data: [
      { clienteId: clientes[0].id, tagId: tags[0].id }, // João - VIP
      { clienteId: clientes[0].id, tagId: tags[2].id }, // João - Recorrente
      { clienteId: clientes[1].id, tagId: tags[1].id }, // Maria - Interessado
    ],
  });

  // Criar vendas de exemplo
  const hoje = new Date();
  const vendas = await Promise.all([
    prisma.venda.create({
      data: {
        clienteId: clientes[0].id,
        chipId: chip1.id,
        valor: 197.00,
        status: 'confirmado',
        descricao: 'Produto X - Plano Básico',
      },
    }),
    prisma.venda.create({
      data: {
        clienteId: clientes[0].id,
        chipId: chip1.id,
        valor: 497.00,
        status: 'confirmado',
        descricao: 'Produto Y - Plano Premium',
      },
    }),
    prisma.venda.create({
      data: {
        clienteId: clientes[1].id,
        chipId: chip1.id,
        valor: 97.00,
        status: 'pendente',
        descricao: 'Produto Z - Avulso',
      },
    }),
    prisma.venda.create({
      data: {
        clienteId: clientes[3].id,
        chipId: chip2.id,
        valor: 297.00,
        status: 'confirmado',
        descricao: 'Produto X - Plano Intermediário',
      },
    }),
  ]);
  console.log(`Vendas criadas: ${vendas.length}`);

  // Criar conversas de exemplo
  await prisma.conversa.createMany({
    data: [
      {
        clienteId: clientes[0].id,
        chipId: chip1.id,
        tipo: 'recebida',
        conteudo: 'Oi, quero saber mais sobre o produto X',
      },
      {
        clienteId: clientes[0].id,
        chipId: chip1.id,
        tipo: 'enviada',
        conteudo: 'Olá João! O Produto X é perfeito para você. Posso te enviar mais detalhes?',
      },
      {
        clienteId: clientes[0].id,
        chipId: chip1.id,
        tipo: 'recebida',
        conteudo: 'Sim, pode enviar!',
      },
      {
        clienteId: clientes[1].id,
        chipId: chip1.id,
        tipo: 'recebida',
        conteudo: 'Quanto custa o produto Z?',
      },
      {
        clienteId: clientes[2].id,
        chipId: chip2.id,
        tipo: 'recebida',
        conteudo: 'Boa tarde, vi o anúncio e me interessei',
      },
    ],
  });
  console.log('Conversas de exemplo criadas');

  // Criar funil de exemplo
  await prisma.funil.create({
    data: {
      nome: 'Funil de Boas-vindas',
      descricao: 'Funil automático para novos leads',
      ativo: true,
      blocos: [
        {
          id: 'bloco-1',
          type: 'texto',
          position: { x: 250, y: 50 },
          data: {
            mensagem: 'Olá {nome}! Seja bem-vindo! 🎉\nComo posso te ajudar hoje?',
          },
        },
        {
          id: 'bloco-2',
          type: 'delay',
          position: { x: 250, y: 200 },
          data: {
            tempo: 5,
            unidade: 'minutos',
          },
        },
        {
          id: 'bloco-3',
          type: 'botoes',
          position: { x: 250, y: 350 },
          data: {
            mensagem: 'Você gostaria de:',
            opcoes: [
              { id: 'opt-1', texto: 'Ver produtos', valor: 'produtos' },
              { id: 'opt-2', texto: 'Falar com atendente', valor: 'atendente' },
            ],
          },
        },
        {
          id: 'bloco-4',
          type: 'ia',
          position: { x: 100, y: 500 },
          data: {
            mensagemBase: 'Temos produtos incríveis para você! Posso te mostrar nosso catálogo?',
            tom: 'vendedor',
            contexto: 'Venda de cursos online de marketing digital',
          },
        },
        {
          id: 'bloco-5',
          type: 'transferencia',
          position: { x: 400, y: 500 },
          data: {
            mensagem: 'Vou te transferir para um de nossos atendentes. Aguarde um momento!',
          },
        },
      ],
      conexoes: [
        { source: 'bloco-1', target: 'bloco-2' },
        { source: 'bloco-2', target: 'bloco-3' },
        { source: 'bloco-3', target: 'bloco-4', sourceHandle: 'opt-1' },
        { source: 'bloco-3', target: 'bloco-5', sourceHandle: 'opt-2' },
      ],
    },
  });
  console.log('Funil de exemplo criado');

  // Configurações iniciais
  await prisma.configuracao.createMany({
    data: [
      { chave: 'horario_inicio', valor: '08:00' },
      { chave: 'horario_fim', valor: '22:00' },
      { chave: 'dias_funcionamento', valor: 'seg,ter,qua,qui,sex,sab' },
      { chave: 'mensagem_fora_horario', valor: 'Olá! No momento estamos fora do horário de atendimento. Retornaremos em breve!' },
    ],
  });
  console.log('Configurações iniciais criadas');

  console.log('\nSeed concluído com sucesso!');
  console.log('Login: admin@crm.com / admin123');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
