#!/bin/sh

# Log startup information
echo "Starting agent application..."

# Debugging: Print Mastra and Node.js versions
echo "Mastra Version:"
npx mastra --version || echo "Could not get Mastra version"
echo "Node.js Version:"
node --version

# Debugging: Print environment variables
echo "Environment Variables:"
env | grep -E '^(OPENAI_API_KEY|GITHUB_TOKEN|GITHUB_OWNER|GITHUB_REPO|DISCORD_BOT_BASE_URL|DISCORD_CHANNEL_ID)='

# Debugging: List .mastra directory contents
echo "Contents of .mastra directory:"
ls -la .mastra
echo "Contents of .mastra/output directory:"
ls -la .mastra/output

# Debugging: Extract context around the problematic line
extract_error_context() {
  local file="$1"
  local line_number="$2"
  local context_lines=10

  echo "Extracting context around line $line_number:"
  awk -v line="$line_number" -v context="$context_lines" '
    NR >= line - context && NR <= line + context {
      if (NR == line) {
        print ">>> " $0
      } else {
        print $0
      }
    }
  ' "$file"
}

# Check for the entry point in different possible locations
if [ -f ".mastra/output/index.mjs" ]; then
  echo "Found entry point at .mastra/output/index.mjs"
  
  # Extract context around the problematic line
  extract_error_context ".mastra/output/index.mjs" 24951
  
  # Try running with comprehensive debugging
  NODE_OPTIONS="--trace-warnings --trace-deprecation --trace-uncaught --unhandled-rejections=strict" \
  node \
    --experimental-vm-modules \
    --no-warnings \
    .mastra/output/index.mjs
else
  echo "Error: Could not find entry point. Listing available files:"
  find . -name "*.js" -o -name "*.mjs" | grep -v "node_modules"
  exit 1
fi
