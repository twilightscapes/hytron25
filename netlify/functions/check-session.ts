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
    const { sessionId } = JSON.parse(event.body || '{}');
    
    if (!sessionId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Session ID required' })
      };
    }

    // Check Stripe to see if this session was paid
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid') {
      // Create token for this session
      const customerEmail = session.customer_details?.email;
      const plan = session.metadata?.plan;
      
      if (customerEmail && plan) {
        const token = await createStripeToken(customerEmail, plan, sessionId);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            paid: true,
            token: token
          })
        };
      }
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        paid: session.payment_status === 'paid',
        status: session.payment_status
      })
    };

  } catch (error) {
    console.error('Error checking session:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to check session' 
      })
    };
  }
};

async function createStripeToken(email: string, plan: string, sessionId: string) {
  try {
    // Load existing stripe tokens
    const tokensPath = path.join(process.cwd(), 'netlify', 'stripe-tokens.json');
    
    let stripeTokens: any = {};
    try {
      const data = await fs.readFile(tokensPath, 'utf8');
      stripeTokens = JSON.parse(data);
    } catch (err) {
      console.log('Creating new stripe tokens file');
    }

    // Generate a unique token ID
    const tokenId = `stripe_${email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    
    // Determine access level based on plan
    let accessLevel = 'unlimited';
    if (plan === 'premium' || plan === 'premium-upgrade') {
      accessLevel = 'premium';
    }

    // Create token entry
    const tokenEntry = {
      code: tokenId,
      email: email,
      description: `Stripe purchase - ${plan} plan`,
      expiresAt: "2099-12-31",
      maxUses: 1,
      usedCount: 0,
      isActive: true,
      createdBy: "Stripe",
      accessLevel: accessLevel,
      features: [],
      stripeSessionId: sessionId,
      purchaseDate: new Date().toISOString(),
      plan: plan
    };

    // Add to tokens
    stripeTokens[tokenId] = tokenEntry;

    // Save back to file
    await fs.writeFile(tokensPath, JSON.stringify(stripeTokens, null, 2));
    
    console.log(`Created token ${tokenId} for email ${email} with plan ${plan}`);
    return tokenEntry;
    
  } catch (error) {
    console.error('Error creating stripe token:', error);
    throw error;
  }
}

export { handler };
