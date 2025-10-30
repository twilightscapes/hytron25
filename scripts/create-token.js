#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate a random token code
function generateTokenCode(length = 12) {
  return crypto.randomBytes(length).toString('hex').toUpperCase().slice(0, length);
}

// Create a new membership token
function createToken(options = {}) {
  const {
    code = generateTokenCode(),
    description = 'Auto-generated membership token',
    expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
    isActive = true,
    usageLimit = 100,
    usedCount = 0,
    source = 'generator',
    notes = `Generated on ${new Date().toLocaleDateString()}`
  } = options;

  const token = {
    code,
    description,
    expiresAt,
    isActive,
    usageLimit,
    usedCount,
    metadata: {
      source,
      notes
    }
  };

  // Save to file
  const tokensDir = path.join(path.dirname(__dirname), 'src/content/membershipTokens');
  const filename = `${code.toLowerCase()}.json`;
  const filepath = path.join(tokensDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(token, null, 2));
  
  console.log(`✅ Created token: ${code}`);
  console.log(`📁 Saved to: ${filename}`);
  console.log(`📅 Expires: ${new Date(expiresAt).toLocaleDateString()}`);
  console.log(`🎫 Usage limit: ${usageLimit === 0 ? 'Unlimited' : usageLimit}`);
  
  return token;
}

// Command line usage
const args = process.argv.slice(2);
const options = {};

// Parse command line arguments
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = args[i + 1];
  
  if (key === 'usageLimit') {
    options[key] = parseInt(value) || 0;
  } else if (key === 'isActive') {
    options[key] = value === 'true';
  } else {
    options[key] = value;
  }
}

createToken(options);

export { createToken, generateTokenCode };
