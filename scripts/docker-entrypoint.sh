#!/bin/sh
set -e

echo "🧰 Running database bootstrap…"
node scripts/bootstrap.js

echo "🌐 Starting application…"
exec node build
