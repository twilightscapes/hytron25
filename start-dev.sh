#!/bin/bash

echo "🚀 Starting Astro development server..."
echo "📁 Working directory: $(pwd)"
echo "📦 Node version: $(node --version)"
echo "📦 NPM version: $(npm --version)"

echo "🔍 Checking for existing processes on port 4321..."
if lsof -ti:4321 > /dev/null; then
    echo "⚠️  Port 4321 is already in use. Killing existing process..."
    kill -9 $(lsof -ti:4321)
    sleep 2
fi

echo "🏗️  Running Astro type check..."
npm run check

if [ $? -eq 0 ]; then
    echo "✅ Type check passed"
    echo "🌟 Starting development server..."
    npm run dev
else
    echo "❌ Type check failed. Please fix TypeScript errors first."
    exit 1
fi
