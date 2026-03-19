#!/bin/bash
cd /opt/crm-whatsapp
git stash
git pull
cd backend
npm install
npx prisma generate
pm2 restart crm-whatsapp
cd ../frontend
npm run build
echo "Atualizado com sucesso!"
