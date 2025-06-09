// api/tweet-replies.js - Get replies to a tweet
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
    const { tweetId, username } = req.query;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    if (!tweetId || !username) {
      return res.status(400).json({ error: 'tweetId and username parameters required' });
    }

    console.log('💬 Fetching replies for tweet:', tweetId);

    // Search for replies to this tweet (excluding the original author)
    const searchQuery = `conversation_id:${tweetId} -from:${username}`;
    const encodedQuery = encodeURIComponent(searchQuery);
    
    const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?query=${encodedQuery}&max_results=10&tweet.fields=created_at,author_id,public_metrics,in_reply_to_user_id&expansions=author_id`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.text();
    console.log('📡 Twitter API response status:', response.status);

    if (response.ok) {
      console.log('✅ Replies fetched successfully');
      res.status(200).json(JSON.parse(data));
    } else {
      console.error('❌ Twitter API error:', data);
      res.status(response.status).json({ error: 'Twitter API error', details: data });
    }

  } catch (error) {
    console.error('❌ Error fetching replies:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
