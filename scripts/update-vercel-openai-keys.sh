#!/bin/bash

# Update both OpenAI key variants in Vercel
# Reads from .env.local and updates both OPENAI_API_KEY and OPEN_AI_API_KEY

echo "🔑 Updating OpenAI keys in Vercel..."
echo ""

# Extract key from .env.local
OPENAI_KEY=$(grep "^OPEN_AI_API_KEY=" .env.local | cut -d'=' -f2)

if [ -z "$OPENAI_KEY" ]; then
  echo "❌ Could not find OPEN_AI_API_KEY in .env.local"
  exit 1
fi

echo "✅ Found OpenAI key in .env.local"
echo "   Length: ${#OPENAI_KEY} characters"
echo "   Starts with: ${OPENAI_KEY:0:15}..."
echo ""

# Update OPEN_AI_API_KEY (with underscore)
echo "📝 Updating OPEN_AI_API_KEY in Vercel..."
echo ""
echo "Environments: Production, Preview, Development"
echo ""

# Remove old value first for all environments
echo "Removing old OPEN_AI_API_KEY values..."
vercel env rm OPEN_AI_API_KEY production --yes 2>/dev/null
vercel env rm OPEN_AI_API_KEY preview --yes 2>/dev/null
vercel env rm OPEN_AI_API_KEY development --yes 2>/dev/null

# Add new value to all environments
echo ""
echo "Adding new OPEN_AI_API_KEY..."
echo "$OPENAI_KEY" | vercel env add OPEN_AI_API_KEY production
echo "$OPENAI_KEY" | vercel env add OPEN_AI_API_KEY preview
echo "$OPENAI_KEY" | vercel env add OPEN_AI_API_KEY development

echo ""
echo "✅ OPEN_AI_API_KEY updated in all environments"
echo ""

# Update OPENAI_API_KEY (without underscore)
echo "📝 Updating OPENAI_API_KEY in Vercel..."
echo ""

# Remove old value first for all environments
echo "Removing old OPENAI_API_KEY values..."
vercel env rm OPENAI_API_KEY production --yes 2>/dev/null
vercel env rm OPENAI_API_KEY preview --yes 2>/dev/null
vercel env rm OPENAI_API_KEY development --yes 2>/dev/null

# Add new value to all environments
echo ""
echo "Adding new OPENAI_API_KEY..."
echo "$OPENAI_KEY" | vercel env add OPENAI_API_KEY production
echo "$OPENAI_KEY" | vercel env add OPENAI_API_KEY preview
echo "$OPENAI_KEY" | vercel env add OPENAI_API_KEY development

echo ""
echo "✅ OPENAI_API_KEY updated in all environments"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All OpenAI keys updated successfully!"
echo ""
echo "Both variants updated in all environments:"
echo "  • OPEN_AI_API_KEY (with underscore)"
echo "  • OPENAI_API_KEY (without underscore)"
echo ""
echo "Environments updated:"
echo "  • Production"
echo "  • Preview"
echo "  • Development"
echo ""
echo "Next deployment will use the new key."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
