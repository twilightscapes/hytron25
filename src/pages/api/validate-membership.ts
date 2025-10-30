import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { code, token, email } = body;
    
    // Support both old 'code' parameter and new 'token' parameter
    const membershipCode = code || token;

    if (!membershipCode && !email) {
      return new Response(
        JSON.stringify({ isValid: false, message: 'No membership code or email provided' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // In development, try to proxy to Netlify function first
    if (import.meta.env.DEV && membershipCode) {
      try {
        const netlifyResponse = await fetch('http://localhost:8888/.netlify/functions/validate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: membershipCode, action: 'validate' })
        });
        
        if (netlifyResponse.ok) {
          const result = await netlifyResponse.json();
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      } catch (proxyError) {
        console.log('Netlify function proxy failed, falling back to direct validation');
      }
    }

    // Handle email validation (development fallback)
    if (email && !membershipCode) {
      const testEmails = ['toddlambert@gmail.com', 'test@example.com'];
      
      if (testEmails.includes(email.toLowerCase())) {
        return new Response(JSON.stringify({
          isValid: true,
          valid: true,
          tier: 'premium',
          email: email,
          message: 'Valid membership found'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      
      return new Response(JSON.stringify({
        isValid: false,
        valid: false,
        message: 'No membership found for this email'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Fallback: direct token validation (simplified version)
    // This is a basic fallback for development when Netlify functions aren't available
    const premiumCodes = ['EARLY', 'TODD', 'UNLIMITED', 'PREMIUM', 'VIP'];
    
    if (membershipCode && premiumCodes.includes(membershipCode.toUpperCase())) {
      return new Response(
        JSON.stringify({
          isValid: true,
          valid: true,
          accessLevel: 'premium',
          token: {
            code: code.toUpperCase(),
            description: 'Development token',
            accessLevel: 'premium'
          },
          message: 'Code is valid'
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ isValid: false, message: 'Invalid membership code' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (error) {
    console.error('Membership validation error:', error);
    return new Response(
      JSON.stringify({ isValid: false, message: 'Server error during validation' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({ message: 'Use POST method to validate membership' }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
};
