import type { Handler } from '@netlify/functions';

const handler: Handler = async (event, context) => {
  // Add CORS headers for all responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Ensure we have the Stripe secret key
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY is not available in environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Stripe configuration error',
          details: 'API key not configured'
        })
      };
    }

    const stripe = require('stripe')(stripeSecretKey);

    const { plan, sessionId, action } = JSON.parse(event.body || '{}');
    
    // Handle session retrieval
    if (action === 'get-session-details' && sessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            email: session.customer_details?.email || 'N/A',
            status: session.status,
            payment_status: session.payment_status,
            customer_details: session.customer_details
          })
        };
      } catch (error) {
        console.error('Error retrieving session:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'Failed to retrieve session',
            details: error instanceof Error ? error.message : 'Unknown error'
          })
        };
      }
    }
    
    // Debug logging
    console.log('Plan requested:', plan);
    console.log('Environment variables check:', {
      hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
      hasUnlimitedPrice: !!process.env.STRIPE_UNLIMITED_PRICE_ID,
      hasPremiumPrice: !!process.env.STRIPE_PREMIUM_PRICE_ID,
      hasUrlSite: !!process.env.URLSITE
    });
    
    let priceId;
    let successUrl = `${process.env.URLSITE || 'http://localhost:4321'}/membership?success=true&plan=${plan}`;
    let cancelUrl = `${process.env.URLSITE || 'http://localhost:4321'}/membership?canceled=true`;

    // Get price ID based on plan
    switch (plan) {
      case 'unlimited':
        priceId = process.env.STRIPE_UNLIMITED_PRICE_ID;
        break;
      case 'premium':
        priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
        break;
      case 'premium-upgrade':
        // For upgrade, we could create a separate price or calculate the difference
        // For now, let's use dynamic pricing for the upgrade
        priceId = null; // Will handle this case separately
        break;
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid plan specified' })
        };
    }

    console.log('Price ID for plan', plan, ':', priceId);

    let sessionConfig;

    if (plan === 'premium-upgrade') {
      // Handle upgrade pricing dynamically
      sessionConfig = {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Premium Upgrade',
                description: 'Upgrade from Unlimited to Premium'
              },
              unit_amount: 1000, // $10.00 difference
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          plan: plan,
          session_id: `test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        },
        customer_creation: 'if_required',
        // Collect customer email for recovery
        customer_email: undefined,
      };
    } else {
      // Use predefined price IDs
      sessionConfig = {
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          plan: plan,
          session_id: `test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        },
        customer_creation: 'if_required',
        // Collect customer email for recovery
        customer_email: undefined,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        url: session.url,
        sessionId: session.id 
      })
    };

  } catch (error) {
    console.error('Stripe error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
