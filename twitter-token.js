// api/twitter-token.js - Vercel serverless function for token exchange
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, codeVerifier, clientId, redirectUri } = req.body;

    if (!code || !codeVerifier || !clientId || !redirectUri) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        required: ['code', 'codeVerifier', 'clientId', 'redirectUri']
      });
    }

    console.log('🔄 Token exchange request:', {
      code: code.substring(0, 10) + '...',
      codeVerifier: codeVerifier.substring(0, 10) + '...',
      clientId: clientId.substring(0, 10) + '...',
      redirectUri
    });

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      })
    });

    const tokenData = await tokenResponse.text();

    if (!tokenResponse.ok) {
      console.error('❌ Twitter token exchange failed:', tokenData);
      return res.status(tokenResponse.status).json({ 
        error: 'Token exchange failed',
        details: tokenData,
        status: tokenResponse.status
      });
    }

    const parsedTokenData = JSON.parse(tokenData);
    console.log('✅ Token exchange successful');

    // Return only the access token (don't log the full token for security)
    res.status(200).json({
      access_token: parsedTokenData.access_token,
      token_type: parsedTokenData.token_type,
      expires_in: parsedTokenData.expires_in,
      scope: parsedTokenData.scope
    });

  } catch (error) {
    console.error('❌ Token exchange error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
