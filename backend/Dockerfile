# Use official Node.js Alpine image for a lightweight production build
FROM node:20-alpine

# Set environment to production
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy source code
COPY index.js ./
COPY src/ ./src/

# Expose port
EXPOSE 8000

# Start application
CMD ["node", "index.js"]
