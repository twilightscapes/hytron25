import type { Handler } from '@netlify/functions';
import { promises as fs } from 'fs';
import path from 'path';

const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { plan } = JSON.parse(event.body || '{}');
    
    // Find the most recent token for this plan (within last 2 minutes)
    const recentToken = await findMostRecentToken(plan);
    
    if (recentToken) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          token: recentToken
        })
      };
    } else {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'No recent purchase found'
        })
      };
    }

  } catch (error) {
    console.error('Error finding recent purchase:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to check recent purchase' 
      })
    };
  }
};

async function findMostRecentToken(plan: string) {
  try {
    const tokensPath = path.join(process.cwd(), 'netlify', 'stripe-tokens.json');
    const data = await fs.readFile(tokensPath, 'utf8');
    const tokens = JSON.parse(data);

    // Find tokens for this plan created in the last 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    const recentTokens = Object.values(tokens).filter((token: any) => 
      token.plan === plan &&
      token.isActive &&
      new Date(token.purchaseDate) > twoMinutesAgo &&
      new Date(token.expiresAt) > new Date()
    ) as any[];

    if (recentTokens.length === 0) {
      console.log(`No recent tokens found for plan ${plan}`);
      return null;
    }

    // Get the most recent one
    const latestToken = recentTokens.sort((a, b) => 
      new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
    )[0];

    console.log(`Found recent token for plan ${plan}:`, latestToken.code);
    return latestToken;

  } catch (error) {
    console.error('Error reading stripe tokens:', error);
    return null;
  }
}

export { handler };
