
# Stage 1: Build Frontend
FROM node:14 as frontend
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]

# Stage 2: Build Backend
FROM node:14 as backend
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["node", "src/index.js"]

