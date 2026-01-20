# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# Install deps (cache-friendly)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .

# Builds Angular (expects "build" script in package.json)
RUN npm run build -- --configuration=production

# ---- Runtime stage (Nginx) ----
FROM nginx:alpine

# Copy built Angular output to nginx html directory
# NOTE: Angular usually outputs to /app/dist/<project-name>
# We'll copy the whole dist folder contents.
COPY --from=build /app/dist/postex-fleetforms/browser /usr/share/nginx/html

# Nginx config (SPA + /api proxy)
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
