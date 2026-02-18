FROM node:20-alpine

WORKDIR /app

# Install dependencies for better-sqlite3 and GitHub CLI
RUN apk add --no-cache python3 make g++ curl

# Install GitHub CLI
RUN apk add --no-cache github-cli

# Copy package files
COPY package*.json ./

# Install dependencies and rebuild native modules
RUN npm ci --only=production && npm rebuild better-sqlite3

# Copy application code
COPY . .

# Create data and config directories
RUN mkdir -p /app/data /app/config

# Expose port
EXPOSE 1337

# Run the application
CMD ["npm", "start"]
