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

    console.log('🔍 Auto-creating token for session:', sessionId);

    // Check environment variables first
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key not configured');
    }

    // Initialize Stripe
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    
    // console.log('📝 Session data:', {
    //   id: session.id,
    //   paymentStatus: session.payment_status,
    //   email: session.customer_details?.email,
    //   plan: session.metadata?.plan
    // });

    if (session.payment_status === 'paid') {
      const customerEmail = session.customer_details?.email;
      const plan = session.metadata?.plan;
      
      if (customerEmail && plan) {

        
        // Since we can't write to files in Netlify, return the email directly
        // for the client to store locally
        const codePrefix = 'STRIPE';
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        const recoveryCode = `${codePrefix}-${randomSuffix}`;
        
        // Determine access level
        let accessLevel = 'unlimited';
        if (plan === 'premium' || plan === 'premium-upgrade') {
          accessLevel = 'premium';
        }
        

        
        // Return token data for client-side storage
        const tokenData = {
          code: recoveryCode,
          email: customerEmail,
          description: `Stripe purchase - ${plan} plan`,
          expiresAt: "2099-12-31",
          maxUses: 1,
          usedCount: 0,
          isActive: true,
          createdBy: "Stripe-Auto",
          accessLevel: accessLevel,
          features: [],
          stripeSessionId: sessionId,
          purchaseDate: new Date().toISOString(),
          plan: plan,
          recoveryCode: recoveryCode
        };
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            paid: true,
            token: tokenData,
            email: customerEmail,
            plan: plan,
            note: "Token stored client-side due to serverless limitations"
          })
        };
      } else {
        
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Missing customer email or plan data' 
          })
        };
      }
    } else {
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          paid: false,
          paymentStatus: session.payment_status
        })
      };
    }

  } catch (error) {
    
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : 'No details available'
      })
    };
  }
};

async function createStripeToken(email: string, plan: string, sessionId: string) {
  try {

    
    // Generate a memorable recovery code
    const codePrefix = 'STRIPE';
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const recoveryCode = `${codePrefix}-${randomSuffix}`;
    

    
    // Load existing stripe tokens
    const tokensPath = path.join(process.cwd(), 'netlify', 'stripe-tokens.json');

    
    let stripeTokens: any = {};
    try {
      const data = await fs.readFile(tokensPath, 'utf8');
      stripeTokens = JSON.parse(data);

    } catch (err) {

      
      // Make sure the directory exists
      const dir = path.dirname(tokensPath);
      try {
        await fs.mkdir(dir, { recursive: true });

      } catch (mkdirErr) {

      }
    }

    // Determine access level based on plan
    let accessLevel = 'unlimited';
    if (plan === 'premium' || plan === 'premium-upgrade') {
      accessLevel = 'premium';
    }

    // Create token entry using the recovery code as the key
    const tokenEntry = {
      code: recoveryCode,
      email: email,
      description: `Stripe purchase - ${plan} plan`,
      expiresAt: "2099-12-31", // Long expiry for purchased tokens
      maxUses: 1,
      usedCount: 0,
      isActive: true,
      createdBy: "Stripe-Auto",
      accessLevel: accessLevel,
      features: [],
      stripeSessionId: sessionId,
      purchaseDate: new Date().toISOString(),
      plan: plan,
      recoveryCode: recoveryCode // Store recovery code for reference
    };

    // Add to tokens using recovery code as key
    stripeTokens[recoveryCode] = tokenEntry;

    // Save back to file

    await fs.writeFile(tokensPath, JSON.stringify(stripeTokens, null, 2));

    

    
    return tokenEntry;
    
  } catch (error) {

    throw error;
  }
}

export { handler };
