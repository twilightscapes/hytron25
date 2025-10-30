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
    const { token, email } = JSON.parse(event.body || '{}');

    // Check both token systems
    const validation = await validateMembershipAccess(token, email);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(validation)
    };

  } catch (error) {
    console.error('Token validation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        valid: false, 
        error: 'Validation failed' 
      })
    };
  }
};

async function validateMembershipAccess(token?: string, email?: string) {
  try {
    // If email looks like a recovery code (contains hyphens and uppercase), treat it as a token
    if (email && (email.includes('-') && email.match(/^[A-Z0-9-]+$/i))) {
      console.log('Email looks like recovery code, treating as token:', email);
      const keystatic = await validateKeystatic(email);
      if (keystatic.valid) {
        return keystatic;
      }
    }

    // First check traditional tokens (Keystatic managed)
    if (token) {
      const keystatic = await validateKeystatic(token);
      if (keystatic.valid) {
        return keystatic;
      }
    }

    // Then check Stripe tokens by email
    if (email && email.includes('@')) {
      const stripe = await validateStripeToken(email);
      if (stripe.valid) {
        return stripe;
      }
    }

    // No valid access found
    return { valid: false, tier: 'free', source: 'none' };

  } catch (error) {
    console.error('Error in validateMembershipAccess:', error);
    return { valid: false, tier: 'free', source: 'error' };
  }
}

async function validateKeystatic(token: string) {
  try {
    // First check the Keystatic tokens (membership-tokens.json)
    const keystatic_tokensPath = path.join(process.cwd(), 'netlify', 'membership-tokens.json');
    const keystatic_data = await fs.readFile(keystatic_tokensPath, 'utf8');
    const keystatic_tokens = JSON.parse(keystatic_data);

    const keystatic_tokenData = keystatic_tokens[token.toUpperCase()];
    
    if (keystatic_tokenData && keystatic_tokenData.isActive) {
      // Check expiry
      if (keystatic_tokenData.expiresAt && new Date(keystatic_tokenData.expiresAt) < new Date()) {
        return { valid: false, tier: 'free', source: 'keystatic', reason: 'expired' };
      }

      // Check usage limits
      if (keystatic_tokenData.maxUses > 0 && keystatic_tokenData.usedCount >= keystatic_tokenData.maxUses) {
        return { valid: false, tier: 'free', source: 'keystatic', reason: 'usage_exceeded' };
      }

      return {
        valid: true,
        tier: keystatic_tokenData.accessLevel || 'unlimited',
        source: 'keystatic',
        tokenData: {
          code: keystatic_tokenData.code,
          description: keystatic_tokenData.description,
          accessLevel: keystatic_tokenData.accessLevel,
          features: keystatic_tokenData.features || []
        }
      };
    }

    // If not found in Keystatic tokens, check Stripe tokens file for recovery codes
    try {
      const stripe_tokensPath = path.join(process.cwd(), 'netlify', 'stripe-tokens.json');
      const stripe_data = await fs.readFile(stripe_tokensPath, 'utf8');
      const stripe_tokens = JSON.parse(stripe_data);

      // Check if the token exists in Stripe tokens (recovery codes)
      const stripe_tokenData = stripe_tokens[token.toUpperCase()];
      
      if (stripe_tokenData && stripe_tokenData.isActive) {
        // Check expiry
        if (stripe_tokenData.expiresAt && new Date(stripe_tokenData.expiresAt) < new Date()) {
          return { valid: false, tier: 'free', source: 'stripe-recovery', reason: 'expired' };
        }

        return {
          valid: true,
          tier: stripe_tokenData.accessLevel || 'unlimited',
          source: 'stripe-recovery',
          tokenData: {
            code: stripe_tokenData.code,
            description: stripe_tokenData.description,
            accessLevel: stripe_tokenData.accessLevel,
            email: stripe_tokenData.email,
            features: stripe_tokenData.features || []
          }
        };
      }
    } catch (stripeError) {
      console.log('No Stripe tokens file or error reading it:', stripeError instanceof Error ? stripeError.message : 'Unknown');
    }

    return { valid: false, tier: 'free', source: 'keystatic' };

  } catch (error) {
    console.error('Error validating Keystatic token:', error);
    return { valid: false, tier: 'free', source: 'keystatic' };
  }
}

async function validateStripeToken(email: string) {
  try {
    const tokensPath = path.join(process.cwd(), 'netlify', 'stripe-tokens.json');
    const data = await fs.readFile(tokensPath, 'utf8');
    const tokens = JSON.parse(data);

    // Find active token for this email
    const userToken = Object.values(tokens).find((token: any) => 
      token.email?.toLowerCase() === email.toLowerCase() && 
      token.isActive &&
      new Date(token.expiresAt) > new Date()
    ) as any;

    if (!userToken) {
      return { valid: false, tier: 'free', source: 'stripe' };
    }

    return {
      valid: true,
      tier: userToken.accessLevel || 'unlimited',
      source: 'stripe',
      tokenData: {
        email: userToken.email,
        plan: userToken.plan,
        purchaseDate: userToken.purchaseDate,
        accessLevel: userToken.accessLevel,
        features: userToken.features || []
      }
    };

  } catch (error) {
    console.error('Error validating Stripe token:', error);
    return { valid: false, tier: 'free', source: 'stripe' };
  }
}

export { handler };
