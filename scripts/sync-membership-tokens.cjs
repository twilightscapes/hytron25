#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple YAML parser for basic key-value pairs
function parseSimpleYaml(yamlContent) {
  const lines = yamlContent.split('\n');
  const result = {};
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        let value = trimmed.substring(colonIndex + 1).trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Convert boolean strings
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        // Convert numbers
        else if (!isNaN(Number(value)) && value !== '') value = Number(value);
        // Convert arrays
        else if (value === '[]') value = [];
        
        result[key] = value;
      }
    }
  }
  
  return result;
}

// Paths
const yamlDir = path.join(__dirname, '../src/content/membershipTokens');
const jsonFile = path.join(__dirname, '../netlify/membership-tokens.json');

console.log('Syncing membership tokens from YAML to JSON...');

try {
  // Read all YAML files
  const yamlFiles = fs.readdirSync(yamlDir).filter(file => file.endsWith('.yaml'));
  const tokens = {};

  yamlFiles.forEach(file => {
    const filePath = path.join(yamlDir, file);
    const yamlContent = fs.readFileSync(filePath, 'utf8');
    const tokenData = parseSimpleYaml(yamlContent);
    
    if (tokenData && tokenData.code) {
      tokens[tokenData.code] = tokenData;
      console.log(`✓ Added token: ${tokenData.code}`);
    }
  });

  // Write to JSON file
  fs.writeFileSync(jsonFile, JSON.stringify(tokens, null, 2));
  console.log(`✓ Successfully synced ${Object.keys(tokens).length} tokens to ${jsonFile}`);

} catch (error) {
  console.error('Error syncing tokens:', error);
  process.exit(1);
}
