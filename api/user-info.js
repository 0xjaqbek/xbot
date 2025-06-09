// api/user-info.js - Get current user information
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    console.log('👤 Fetching user info...');

    const response = await fetch('https://api.twitter.com/2/users/me?user.fields=public_metrics,profile_image_url', {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.text();
    console.log('📡 Twitter API response status:', response.status);

    if (response.ok) {
      console.log('✅ User info fetched successfully');
      res.status(200).json(JSON.parse(data));
    } else {
      console.error('❌ Twitter API error:', data);
      res.status(response.status).json({ error: 'Twitter API error', details: data });
    }

  } catch (error) {
    console.error('❌ Error fetching user info:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
