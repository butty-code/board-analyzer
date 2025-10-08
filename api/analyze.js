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

  const { apiKey, fileType, base64Data, textData } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key required' });
  }

  try {
    const messageContent = [];

    // Handle PDF files
    if (fileType === 'pdf' && base64Data) {
      messageContent.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64Data
        }
      });
    } else if (textData) {
      // Handle text files
      messageContent.push({
        type: "text",
        text: `Document content:\n\n${textData}\n\n---\n\n`
      });
    } else {
      return res.status(400).json({ error: 'No valid file data provided' });
    }

    // Add analysis instructions
    messageContent.push({
      type: "text",
      text: `Analyze this document and extract:
1. Critical risks (title, description, severity: high/medium/low)
2. Key decisions (title, description, status: approved/pending/discussed)
3. Essential questions (title, description, priority: high/medium/low)
4. Executive summary

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "risks": [{"title":"","description":"","severity":""}],
  "decisions": [{"title":"","description":"","status":""}],
  "questions": [{"title":"","description":"","priority":""}],
  "summary": ""
}`
    });

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: messageContent
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
    let text = data.content[0].text;
    
    // Clean up response
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const analysis = JSON.parse(text);
    return res.status(200).json(analysis);

  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      error: error.message || 'Analysis failed'
    });
  }
}
