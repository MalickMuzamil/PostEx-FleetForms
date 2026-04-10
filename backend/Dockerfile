# Use Node 20 (matches your runtime)
FROM node:20

# App directory inside container
WORKDIR /app

# Install dependencies first (cache-friendly)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Expose backend port (must match .env PORT)
EXPOSE 5000

# Do NOT hardcode NODE_ENV or PORT here
# They will be injected from .env via docker-compose

CMD ["npm", "start"]
