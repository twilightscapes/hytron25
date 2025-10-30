import type { Handler } from '@netlify/functions';
import { promises as fs } from 'fs';
import path from 'path';

const handler: Handler = async (event, context) => {
  console.log('🚀 Webhook received!', {
    method: event.httpMethod,
    headers: Object.keys(event.headers),
    hasBody: !!event.body,
    bodyLength: event.body?.length
  });

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    console.log('❌ Invalid method:', event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook not configured' })
    };
  }

  let stripeEvent;

  try {
    // Verify webhook signature
    const sig = event.headers['stripe-signature'];
    console.log('🔐 Verifying signature...', { hasSig: !!sig, hasSecret: !!endpointSecret });
    
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
    console.log('✅ Signature verified successfully');
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid signature' })
    };
  }

  console.log('📨 Received Stripe webhook:', stripeEvent.type);

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(stripeEvent.data.object);
        break;
      default:
        console.log('Unhandled event type:', stripeEvent.type);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' })
    };
  }
};

async function handleCheckoutCompleted(session: any) {
  console.log('💰 Processing checkout completed:', {
    sessionId: session.id,
    paymentStatus: session.payment_status,
    email: session.customer_details?.email,
    plan: session.metadata?.plan
  });
  
  // Extract customer email and plan from session
  const customerEmail = session.customer_details?.email;
  const plan = session.metadata?.plan;
  
  if (!customerEmail || !plan) {
    console.error('❌ Missing required data:', { customerEmail, plan, metadata: session.metadata });
    return;
  }

  console.log('✅ Creating token for:', { email: customerEmail, plan });
  
  // Create a token for this purchase
  await createStripeToken(customerEmail, plan, session.id);
  
  console.log('🎉 Token created successfully for', customerEmail);
}

async function handlePaymentSucceeded(paymentIntent: any) {
  console.log('Processing payment success:', paymentIntent.id);
  // Additional backup processing if needed
}

async function createStripeToken(email: string, plan: string, sessionId: string) {
  try {
    console.log('🏗️ Creating stripe token:', { email, plan, sessionId });
    
    // Load existing stripe tokens
    const tokensPath = path.join(process.cwd(), 'netlify', 'stripe-tokens.json');
    console.log('📁 Tokens file path:', tokensPath);
    
    let stripeTokens: any = {};
    try {
      const data = await fs.readFile(tokensPath, 'utf8');
      stripeTokens = JSON.parse(data);
      console.log('📖 Loaded existing tokens, count:', Object.keys(stripeTokens).length);
    } catch (err) {
      // File doesn't exist yet, start with empty object
      console.log('📝 Creating new stripe tokens file');
    }

    // Generate a unique token ID based on email and timestamp
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
      expiresAt: "2099-12-31", // Long expiry for purchased tokens
      maxUses: 1, // One use per email
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
    
    console.log(`🎯 Successfully created token ${tokenId} for email ${email} with plan ${plan}`);
    console.log('💾 Token saved to file, total tokens now:', Object.keys(stripeTokens).length);
    
  } catch (error) {
    console.error('💥 Error creating stripe token:', error);
    throw error;
  }
}

export { handler };
