// api/twitter-token.js - Vercel serverless function for Twitter token exchange
export default async function handler(req, res) {
  // Enable CORS for your domain
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Or specify your domain
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', allowedMethods: ['POST'] });
  }

  try {
    console.log('🔄 Starting token exchange...');
    
    const { code, codeVerifier, clientId, redirectUri } = req.body;

    // Validate required parameters
    if (!code || !codeVerifier || !clientId || !redirectUri) {
      console.error('❌ Missing parameters:', { 
        code: !!code, 
        codeVerifier: !!codeVerifier, 
        clientId: !!clientId, 
        redirectUri: !!redirectUri 
      });
      return res.status(400).json({ 
        error: 'Missing required parameters',
        required: ['code', 'codeVerifier', 'clientId', 'redirectUri'],
        received: {
          code: !!code,
          codeVerifier: !!codeVerifier,
          clientId: !!clientId,
          redirectUri: !!redirectUri
        }
      });
    }

    // Log request details (without sensitive data)
    console.log('📡 Token exchange request:', {
      codeLength: code.length,
      codeVerifierLength: codeVerifier.length,
      clientIdLength: clientId.length,
      redirectUri
    });

    // Prepare the token exchange request
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    });

    console.log('🚀 Calling Twitter token endpoint...');

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenRequestBody
    });

    const responseText = await tokenResponse.text();
    console.log('📡 Twitter API response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      console.error('❌ Twitter token exchange failed:', responseText);
      return res.status(tokenResponse.status).json({ 
        error: 'Token exchange failed',
        twitterError: responseText,
        status: tokenResponse.status,
        details: 'Check if your OAuth app settings are correct'
      });
    }

    // Parse the successful response
    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse token response:', parseError);
      return res.status(500).json({ 
        error: 'Failed to parse Twitter response',
        rawResponse: responseText
      });
    }

    console.log('✅ Token exchange successful!');

    // Return the token data (be careful not to log the actual tokens)
    res.status(200).json({
      access_token: tokenData.access_token,
      token_type: tokenData.token_type || 'bearer',
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
      refresh_token: tokenData.refresh_token // If present
    });

  } catch (error) {
    console.error('❌ Unexpected error in token exchange:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      type: error.name
    });
  }
}
