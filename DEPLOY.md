# Deploy - VPS Ubuntu 22.04

## 1. Preparar o servidor

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar Docker e Docker Compose
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Instalar PM2 (gerenciador de processos)
sudo npm install -g pm2

# Instalar Nginx (proxy reverso)
sudo apt install -y nginx
```

## 2. Clonar o projeto

```bash
cd /opt
sudo git clone SEU_REPOSITORIO crm-whatsapp
sudo chown -R $USER:$USER /opt/crm-whatsapp
cd /opt/crm-whatsapp
```

## 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
nano .env
```

Preencher com valores reais:
- `JWT_SECRET` - gerar com: `openssl rand -hex 32`
- `DATABASE_URL` - manter padrão se usar Docker
- `EVOLUTION_API_URL` - URL da sua Evolution API
- `EVOLUTION_API_KEY` - chave da Evolution API
- `ANTHROPIC_API_KEY` - sua chave da Claude API

## 4. Subir banco e Redis

```bash
docker-compose up -d
```

Verificar se estão rodando:
```bash
docker ps
```

## 5. Instalar dependências

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

## 6. Configurar banco de dados

```bash
cd backend
npx prisma migrate deploy
npx prisma db seed
cd ..
```

## 7. Build do frontend

```bash
cd frontend
npm run build
cd ..
```

## 8. Iniciar com PM2

```bash
cd backend
pm2 start server.js --name crm-whatsapp
pm2 save
pm2 startup
```

## 9. Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/crm-whatsapp
```

Conteúdo:
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    client_max_body_size 10M;

    location / {
        root /opt/crm-whatsapp/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /uploads {
        proxy_pass http://localhost:3001;
    }
}
```

Ativar:
```bash
sudo ln -s /etc/nginx/sites-available/crm-whatsapp /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 10. SSL com Certbot (HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com
```

## 11. Configurar webhook da Evolution API

Na Evolution API, configurar webhook apontando para:
```
https://seu-dominio.com/api/webhook/evolution
```

## 12. Comandos úteis

```bash
# Ver logs do backend
pm2 logs crm-whatsapp

# Reiniciar backend
pm2 restart crm-whatsapp

# Ver status dos containers
docker ps

# Acessar banco PostgreSQL
docker exec -it crm_postgres psql -U crm -d crm_whatsapp

# Ver fila Redis
docker exec -it crm_redis redis-cli

# Atualizar aplicação
cd /opt/crm-whatsapp
git pull
cd backend && npm install && npx prisma migrate deploy
cd ../frontend && npm install && npm run build
pm2 restart crm-whatsapp
```

## Acesso inicial

- URL: https://seu-dominio.com
- Email: admin@crm.com
- Senha: admin123

**IMPORTANTE: Troque a senha do admin após o primeiro login!**
