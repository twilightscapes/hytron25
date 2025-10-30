// API route to proxy Netlify function for local development
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    console.log('🔍 validate-stripe-email API called with:', body);
    
    // In development, we'll need to import the Netlify function directly
    // or proxy to a running Netlify dev server
    
    // For now, let's simulate the function behavior
    // You can replace this with actual logic or proxy to netlify dev
    const { email } = body;
    
    if (!email) {
      console.log('❌ No email provided');
      return new Response(JSON.stringify({ 
        valid: false,
        success: false, 
        message: 'Email is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Simulate checking against known test emails
    // In production, this would be handled by the actual Netlify function
    const testEmails = ['toddlambert@gmail.com', 'test@example.com'];
    
    if (testEmails.includes(email.toLowerCase())) {
      console.log('✅ Email found in test emails, returning success');
      const response = {
        valid: true,
        success: true,
        message: 'Valid membership found',
        tier: 'premium',
        email: email,
        plan: 'premium',
        sessionId: 'dev-session-' + Date.now(),
        tokenData: {
          code: 'EMAIL_VERIFIED',
          accessLevel: 'premium'
        }
      };
      console.log('📤 Sending response:', response);
      
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('❌ Email not found in test emails');
    return new Response(JSON.stringify({
      valid: false,
      success: false,
      message: 'No membership found for this email'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error in validate-stripe-email proxy:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
