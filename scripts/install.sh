#!/bin/bash
# Deadrop installation script

set -e

echo "🚀 Installing Deadrop..."

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Link CLI globally (optional)
echo "🔗 Linking CLI globally..."
npm link

# Test installation
echo "✅ Testing installation..."
deadrop --version

# Run basic functionality test
echo "🧪 Running functionality test..."
deadrop send --to test --from installer --body "Installation test"
deadrop check --agent test > /dev/null

echo ""
echo "✨ Deadrop installation complete!"
echo "📖 Usage: deadrop --help"
echo "📍 Database location: ${DEADROP_DB:-~/.openclaw/workspace/deadrop.sqlite}"
echo "   (Override with DEADROP_DB environment variable)"
echo ""
echo "🔄 Integration pattern:"
echo "  Send: deadrop send --to agent --from sender --body 'message'"
echo "  Check: deadrop check --agent agent"
echo "  Inbox: deadrop inbox --agent agent"