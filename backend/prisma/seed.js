// Seed - Dados iniciais (somente admin e configuracoes)
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed do banco de dados...');

  // Criar usuario admin padrao
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
  console.log(`Usuario admin criado: ${admin.email}`);

  // Tags padrao
  const tags = await Promise.all([
    prisma.tag.upsert({ where: { nome: 'VIP' }, update: {}, create: { nome: 'VIP', cor: '#F59E0B' } }),
    prisma.tag.upsert({ where: { nome: 'Interessado' }, update: {}, create: { nome: 'Interessado', cor: '#3B82F6' } }),
    prisma.tag.upsert({ where: { nome: 'Recorrente' }, update: {}, create: { nome: 'Recorrente', cor: '#10B981' } }),
    prisma.tag.upsert({ where: { nome: 'Inadimplente' }, update: {}, create: { nome: 'Inadimplente', cor: '#EF4444' } }),
  ]);
  console.log(`Tags criadas: ${tags.map(t => t.nome).join(', ')}`);

  // Configuracoes iniciais
  const configs = [
    { chave: 'horario_inicio', valor: '08:00' },
    { chave: 'horario_fim', valor: '22:00' },
    { chave: 'dias_funcionamento', valor: 'seg,ter,qua,qui,sex,sab' },
    { chave: 'mensagem_fora_horario', valor: 'Ola! No momento estamos fora do horario de atendimento. Retornaremos em breve!' },
  ];

  for (const cfg of configs) {
    await prisma.configuracao.upsert({
      where: { chave: cfg.chave },
      update: {},
      create: cfg,
    });
  }
  console.log('Configuracoes iniciais criadas');

  console.log('\nSeed concluido com sucesso!');
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
