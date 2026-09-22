FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
# Database migrations run once in the platform's pre-deploy job.
CMD ["npm", "run", "start:production"]
