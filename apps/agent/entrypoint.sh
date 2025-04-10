#!/bin/sh

# Log startup information
echo "Starting agent application..."

# Check for the entry point in different possible locations
if [ -f ".mastra/output/index.mjs" ]; then
  echo "Found entry point at .mastra/output/index.mjs"

  # Extract context around the problematic line
  extract_error_context ".mastra/output/index.mjs" 24951
  
  # Change dir to output folder
  cd .mastra/output/

  # Try running with comprehensive debugging
  NODE_OPTIONS="--trace-warnings --trace-deprecation --trace-uncaught --unhandled-rejections=strict" \
  node \
    --experimental-vm-modules \
    --no-warnings \
    ./index.mjs
else
  echo "Error: Could not find entry point. Listing available files:"
  find . -name "*.js" -o -name "*.mjs" | grep -v "node_modules"
  exit 1
fi
