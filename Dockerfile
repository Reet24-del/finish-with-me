FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV PORT=4318
EXPOSE 4318
CMD ["npm","start"]
