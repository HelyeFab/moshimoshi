#!/bin/bash

# Script to update Firebase Functions configuration with Stripe price IDs
# This ensures the Firebase Functions have the correct price IDs configured

echo "Updating Firebase Functions configuration..."

# Set test price IDs (from .env.local)
firebase functions:config:set \
  stripe.price_monthly_test="price_1S6wG7HdrJomitOw5YvQ71DD" \
  stripe.price_yearly_test="price_1S6wGGHdrJomitOwcmT2JeUG" \
  stripe.webhook_secret_test="whsec_LkMzY7qpfcMmbxRucp66ANJIbpadRjQx"

# Set production price IDs (same as test for now, update when you have production prices)
firebase functions:config:set \
  stripe.price_monthly_prod="price_1S6vKuHdrJomitOw4XuExllV" \
  stripe.price_yearly_prod="price_1S6vMBHdrJomitOwweaSGhYp" \
  stripe.webhook_secret_prod="whsec_1I7OR9Nt0ME8QVUekxkDA8MpkyYUFxYU"

# Set app URL for session invalidation
firebase functions:config:set \
  app.url="https://moshimoshi.vercel.app"

# Verify the configuration
echo ""
echo "Current Firebase Functions configuration:"
firebase functions:config:get

echo ""
echo "Configuration updated! Don't forget to:"
echo "1. Redeploy functions: firebase deploy --only functions"
echo "2. Or restart emulator if testing locally"