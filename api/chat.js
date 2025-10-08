export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, message, context } = req.body;

  if (!apiKey || !message) {
    return res.status(400).json({ error: 'API key and message required' });
  }

  try {
    let prompt = message;
    
    if (context) {
      prompt = `Context: I have analyzed a board document with the following findings:
- ${context.risks?.length || 0} risks identified
- ${context.decisions?.length || 0} decisions documented
- ${context.questions?.length || 0} questions raised
- Summary: ${context.summary}

User question: ${message}

Please provide helpful advice, solutions, or insights related to this board governance matter.`;
    } else {
      prompt = `You are a board governance and corporate strategy expert. Help the user with their question.

User question: ${message}

Provide practical, actionable advice.`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: errorData.error?.message || 'API request failed'
      });
    }

    const data = await response.json();
    const reply = data.content[0].text;
    
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({
      error: error.message || 'Chat failed'
    });
  }
}
