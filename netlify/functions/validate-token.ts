import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import membershipTokens from '../membership-tokens.json';

interface TokenValidationRequest {
  code: string;
  action?: 'validate' | 'use';
}

interface TokenValidationResponse {
  isValid: boolean;
  valid?: boolean; // Add for frontend compatibility
  accessLevel?: string; // Add access level
  token?: any;
  message?: string;
  remainingUses?: number;
}

interface MembershipToken {
  code: string;
  description: string;
  isActive: boolean;
  accessLevel?: string; // Add access level
  expiresAt?: string | Date;
  maxUses?: number;
  usedCount?: number;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
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
    const { code, action = 'validate' }: TokenValidationRequest = JSON.parse(event.body || '{}');

    if (!code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          isValid: false, 
          message: 'Code is required' 
        } as TokenValidationResponse)
      };
    }

    console.log('Validating membership token:', code);
    console.log('Available tokens:', Object.keys(membershipTokens));
    
    // Get token data from the local JSON file
    const token = membershipTokens[code as keyof typeof membershipTokens];
    
    console.log('Found token:', token);
    
    if (!token) {
      console.log('Token not found in membership tokens');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          isValid: false, 
          valid: false,
          message: 'Invalid code' 
        } as TokenValidationResponse)
      };
    }
    
    // Check if token is active
    if (!token.isActive) {
      console.log('Token is not active:', token.isActive);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          isValid: false, 
          valid: false,
          message: 'Code is no longer active' 
        } as TokenValidationResponse)
      };
    }

    // Check expiration
    if (token.expiresAt) {
      const expirationDate = typeof token.expiresAt === 'string' ? new Date(token.expiresAt) : token.expiresAt;
      if (expirationDate && new Date() > expirationDate) {
        console.log('Token has expired:', expirationDate);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            isValid: false, 
            valid: false,
            message: 'Code has expired' 
          } as TokenValidationResponse)
        };
      }
    }

    // Check if token has usage limit and is over limit
    if (token.maxUses && token.usedCount && token.usedCount >= token.maxUses) {
      console.log('Token usage limit exceeded:', token.usedCount, '/', token.maxUses);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          isValid: false,
          valid: false,
          message: 'Token usage limit exceeded'
        } as TokenValidationResponse)
      };
    }

    const usedCount = token.usedCount || 0;
    const remainingUses = token.maxUses ? token.maxUses - usedCount : undefined;

    if (action === 'use') {
      // In a real implementation, you'd update the usedCount in the database
      // For now, we'll just return the validation
      console.log('Token use action requested (not implemented)');
    }

    console.log('Token validation successful:', {
      code: token.code,
      accessLevel: token.accessLevel,
      remainingUses
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        isValid: true,
        valid: true, // Add this for frontend compatibility
        accessLevel: token.accessLevel || 'basic', // Include access level
        token: {
          code: token.code,
          description: token.description,
          accessLevel: token.accessLevel,
          remainingUses
        },
        message: 'Code is valid',
        remainingUses
      } as TokenValidationResponse)
    };

  } catch (error) {
    console.error('Error validating token:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        isValid: false, 
        valid: false,
        message: 'Internal server error' 
      } as TokenValidationResponse)
    };
  }
};
