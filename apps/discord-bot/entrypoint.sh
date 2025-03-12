#!/bin/sh

# Replace placeholders with environment variables
envsubst < /config/config.example.json > /config/config.json

# Run the Node.js application
exec node dist/start-bot.js
