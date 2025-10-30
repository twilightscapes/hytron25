import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ url }) => {
  const searchParams = url.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return new Response(
      JSON.stringify({ error: 'Code parameter is required' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  try {
    // Get all membership tokens
    const membershipTokens = await getCollection('membershipTokens');
    
    // Find the specific token
    const token = membershipTokens.find(token => token.data.code === code);

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token not found' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Return the token data
    return new Response(
      JSON.stringify({
        code: token.data.code,
        description: token.data.description,
        isActive: token.data.isActive,
        expiresAt: token.data.expiresAt,
        maxUses: token.data.maxUses,
        usedCount: token.data.usedCount,
        accessLevel: token.data.accessLevel, // Add access level to response
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching membership token:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
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

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { code, action = 'validate' } = body;

    if (!code) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Code is required' 
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    
    // Get all membership tokens from the collection
    const membershipTokens = await getCollection('membershipTokens');
    
    // Find the specific token
    const tokenEntry = membershipTokens.find(token => token.data.code === code);

    if (!tokenEntry) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Invalid code' 
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

    const token = tokenEntry.data;
    
    // Check if token is active
    if (!token.isActive) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Code is no longer active' 
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

    // Check expiration
    if (token.expiresAt) {
      const expirationDate = new Date(token.expiresAt);
      if (new Date() > expirationDate) {
        return new Response(
          JSON.stringify({ 
            valid: false, 
            message: 'Code has expired' 
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
    }

    // Check if token has usage limit and is over limit
    if (token.maxUses && token.usedCount && token.usedCount >= token.maxUses) {
      return new Response(
        JSON.stringify({
          valid: false,
          message: 'Token usage limit exceeded'
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

    const usedCount = token.usedCount || 0;
    const remainingUses = token.maxUses ? token.maxUses - usedCount : undefined;

    return new Response(
      JSON.stringify({ 
        valid: true, 
        accessLevel: token.accessLevel || 'basic',
        token: {
          code: token.code,
          description: token.description,
          accessLevel: token.accessLevel,
          remainingUses
        },
        message: 'Code is valid',
        remainingUses
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (error) {
    console.error('Error validating token:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        message: 'Internal server error' 
      }),
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

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
