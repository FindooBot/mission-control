#!/bin/bash
# Push to GitHub script
# Usage: ./push-to-github.sh <your-github-token>

TOKEN=$1

if [ -z "$TOKEN" ]; then
  echo "Usage: ./push-to-github.sh <your-github-token>"
  echo ""
  echo "To create a GitHub Personal Access Token:"
  echo "1. Go to https://github.com/settings/tokens"
  echo "2. Click 'Generate new token (classic)'"
  echo "3. Select 'repo' scope for full repository access"
  echo "4. Generate and copy the token"
  echo "5. Run: ./push-to-github.sh ghp_xxxxxxxxxxxx"
  exit 1
fi

# Remove existing remote if any
git remote remove origin 2>/dev/null || true

# Add remote with token
git remote add origin https://$TOKEN@github.com/finlaysmithclaw/mission-control.git

# Push to GitHub
git push -u origin master

echo ""
echo "✅ Mission Control pushed to GitHub!"
echo "Visit: https://github.com/finlaysmithclaw/mission-control"
