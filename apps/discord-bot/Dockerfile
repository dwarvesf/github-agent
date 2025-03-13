# Use Node.js base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install --production

# Copy application files
COPY . .

# Install envsubst for variable replacement
RUN apk add --no-cache gettext

# Make entrypoint script executable
RUN chmod +x /app/entrypoint.sh

# Expose the API, Webhook, Master port
EXPOSE 3001 3000 5000

# Run the entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]
