// api/post-tweet.js - Post a tweet or reply
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    const { text, replyToTweetId } = req.body;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    if (!text) {
      return res.status(400).json({ error: 'text parameter required' });
    }

    console.log('📤 Posting tweet...');
    console.log('  - Text length:', text.length);
    console.log('  - Reply to:', replyToTweetId || 'None (new tweet)');

    // Prepare request body
    const requestBody = { text };
    
    // Add reply information if this is a reply
    if (replyToTweetId) {
      requestBody.reply = {
        in_reply_to_tweet_id: replyToTweetId
      };
    }

    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.text();
    console.log('📡 Twitter API response status:', response.status);

    if (response.ok) {
      console.log('✅ Tweet posted successfully');
      res.status(200).json(JSON.parse(data));
    } else {
      console.error('❌ Twitter API error:', data);
      res.status(response.status).json({ error: 'Twitter API error', details: data });
    }

  } catch (error) {
    console.error('❌ Error posting tweet:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
