#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// List all available tokens
function listTokens() {
  const tokensDir = path.join(path.dirname(__dirname), 'src/content/membershipTokens');
  const files = fs.readdirSync(tokensDir).filter(f => f.endsWith('.json'));
  
  // console.log('\n🎟️  Available Membership Tokens:\n');
  // console.log('Code'.padEnd(15), 'Description'.padEnd(35), 'Expires'.padEnd(12), 'Usage'.padEnd(10), 'Active');
  // console.log('─'.repeat(15), '─'.repeat(35), '─'.repeat(12), '─'.repeat(10), '─'.repeat(6));
  
  files.forEach(file => {
    const tokenPath = path.join(tokensDir, file);
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    
    const code = token.code || 'N/A';
    const desc = (token.description || 'No description').slice(0, 33);
    const expires = token.expiresAt ? new Date(token.expiresAt).toLocaleDateString() : 'Never';
    const usage = token.usageLimit === 0 ? 'Unlimited' : `${token.usedCount}/${token.usageLimit}`;
    const active = token.isActive ? '✅' : '❌';
    
    // console.log(
    //   code.padEnd(15),
    //   desc.padEnd(35),
    //   expires.padEnd(12),
    //   usage.padEnd(10),
    //   active
    // );
  });
  
  // console.log('\n📝 Usage examples:');
  // console.log('  Test token: npm run test-token UNLIMITED2024');
  // console.log('  Create new: npm run create-token -- --code "MYNEW2024" --description "My new token"');
  // console.log('\n');
}

listTokens();
