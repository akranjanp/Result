# Dockerfile for Result Publishing & Display System
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install curl and tzdata for Indian Standard Time timezone support
RUN apk add --no-cache curl tzdata

# Copy package definitions and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy all source files
COPY . .

# Expose HTTP port
EXPOSE 3000

# Set environment defaults (IST timezone)
ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=Asia/Kolkata

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/public/status || exit 1

# Start the application
CMD ["node", "server/server.js"]
