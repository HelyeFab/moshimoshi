#!/bin/bash

# Start Stripe webhook listeners for multiple ports
# This allows you to run your dev server on any port from 3000-3010

echo "🚀 Starting Stripe webhook listeners for ports 3000-3010..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI is not installed. Please install it first:"
    echo "   brew install stripe/stripe-cli/stripe (Mac)"
    echo "   or visit: https://stripe.com/docs/stripe-cli#install"
    exit 1
fi

# Start webhook forwarding for each port
for port in {3000..3010}; do
    echo -e "${YELLOW}Starting webhook listener for port $port...${NC}"
    stripe listen --forward-to localhost:$port/api/stripe/webhook &
    sleep 0.5  # Small delay to prevent overwhelming the system
done

echo ""
echo -e "${GREEN}✅ All webhook listeners started!${NC}"
echo ""
echo "📝 Your webhook signing secrets are:"
echo "   - Check the terminal output above for each port's secret"
echo "   - Add the appropriate secret to your .env.local file"
echo ""
echo "🎯 You can now run your dev server on any port from 3000-3010"
echo "   Example: PORT=3005 npm run dev"
echo ""
echo "Press Ctrl+C to stop all webhook listeners"

# Wait for user to stop the script
wait