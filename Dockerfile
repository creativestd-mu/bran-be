FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
# Match railway.json so migrations run before the server starts
CMD ["npm", "run", "start:railway"]
