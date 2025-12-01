#!/bin/bash
# Test script to simulate GitHub Actions runtime locally
# This runs the action in a Node.js environment similar to GitHub Actions

set -euo pipefail

echo "Building action..."
pnpm build

echo "Testing action bundle..."
node dist/action/index.js

