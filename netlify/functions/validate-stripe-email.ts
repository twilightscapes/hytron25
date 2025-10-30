import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { email } = JSON.parse(event.body);
    
    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' }),
      };
    }

    console.log('🔍 Validating email against Stripe:', email);

    // Search for completed checkout sessions with the provided email
    // Remove time limitation to search ALL sessions
    let hasMore = true;
    let startingAfter: string | undefined = undefined;
    let searchAttempts = 0;
    const maxSearchAttempts = 10; // Prevent infinite loops
    
    while (hasMore && searchAttempts < maxSearchAttempts) {
      const listParams: Stripe.Checkout.SessionListParams = {
        customer_details: {
          email: email,
        },
        limit: 100,
      };
      
      if (startingAfter) {
        listParams.starting_after = startingAfter;
      }
      
      const sessions = await stripe.checkout.sessions.list(listParams);

      console.log(`🔍 Search attempt ${searchAttempts + 1}: Found ${sessions.data.length} sessions`);

      // Look for paid sessions
      const paidSessions = sessions.data.filter(session => 
        session.payment_status === 'paid'
      );

      if (paidSessions.length > 0) {
        // Get the plan from the most recent paid session's metadata
        const mostRecentSession = paidSessions[0]; // Sessions are ordered by creation date (newest first)
        const planFromMetadata = mostRecentSession.metadata?.plan || 'unlimited';
        
        console.log('✅ Found paid session for email:', email, 'with plan:', planFromMetadata);
        
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            valid: true, 
            tier: planFromMetadata,
            email: email,
            sessionCount: paidSessions.length,
            sessionId: mostRecentSession.id
          }),
        };
      }

      hasMore = sessions.has_more;
      if (hasMore && sessions.data.length > 0) {
        startingAfter = sessions.data[sessions.data.length - 1].id;
      }
      
      searchAttempts++;
    }

    console.log('❌ No paid sessions found for email:', email);
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        valid: false, 
        message: 'No completed purchases found for this email' 
      }),
    };

  } catch (error) {
    console.error('Error validating Stripe email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
