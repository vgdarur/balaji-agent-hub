FROM node:20-bullseye-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://neondb_owner:npg_jCf9YEm2JtAd@ep-dark-mouse-a4zuag3d-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
EXPOSE 8080
CMD ["node", "dist/index.cjs"]
