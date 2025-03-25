#!/bin/sh

# Create config directory if it doesn't exist
mkdir -p ./config

# Replace placeholders with environment variables in all config files
envsubst < ./config/config.example.json > ./config/config.json
envsubst < ./config/bot-sites.example.json > ./config/bot-sites.json
envsubst < ./config/debug.example.json > ./config/debug.json

# Run the Node.js application
exec node dist/start-bot.js
