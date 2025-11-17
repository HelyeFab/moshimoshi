#!/bin/bash

# Fix line endings and deploy Firebase functions
# This script fixes Windows CRLF line endings that prevent deployment

set -e

cd /home/beano/DevProjects/NextJs/moshimoshi

echo "🔧 Fixing line endings in node_modules..."
cd functions

# Fix line endings in all .bin files
find node_modules/.bin -type f -exec sed -i 's/\r$//' {} + 2>/dev/null || true

# Alternative: use perl if sed doesn't work
find node_modules/.bin -type f -exec perl -pi -e 's/\r\n/\n/g' {} + 2>/dev/null || true

echo "✅ Line endings fixed"
echo ""

cd ..

echo "🚀 Deploying functions..."
firebase deploy --only functions:manualNewsScraperFunction,functions:scheduledNewsScraperFunction --project moshimoshi-de237

echo ""
echo "✅ Deployment complete!"
