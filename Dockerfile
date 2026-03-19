FROM node:20
WORKDIR /app

# 1. Instalar dependências do Backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# 2. Instalar dependências do Frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# 3. Copiar o restante do código
COPY . .

# 4. Gerar o Prisma e fazer o BUILD do Frontend
RUN cd backend && npx prisma generate
RUN cd frontend && npm run build

EXPOSE 3000
WORKDIR /app/backend
CMD ["npm", "start"]
