// api/user-tweets.js - Get user's tweets with rate limit handling
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
    const { userId } = req.query;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId parameter required' });
    }

    console.log('📝 Fetching tweets for user:', userId);

    const response = await fetch(`https://api.twitter.com/2/users/${userId}/tweets?max_results=10&tweet.fields=created_at,public_metrics,context_annotations&expansions=author_id`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.text();
    console.log('📡 Twitter API response status:', response.status);

    if (response.ok) {
      console.log('✅ Tweets fetched successfully');
      res.status(200).json(JSON.parse(data));
    } else if (response.status === 429) {
      // Rate limit hit
      console.log('⏰ Rate limit hit for tweets API');
      const retryAfter = response.headers.get('x-rate-limit-reset');
      
      res.status(429).json({ 
        error: 'Rate limit exceeded', 
        message: 'Twitter API rate limit reached. Please wait a few minutes and try again.',
        retryAfter: retryAfter,
        suggestion: 'This is normal during testing. Rate limits reset every 15 minutes.'
      });
    } else {
      console.error('❌ Twitter API error:', data);
      res.status(response.status).json({ error: 'Twitter API error', details: data });
    }

  } catch (error) {
    console.error('❌ Error fetching tweets:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
