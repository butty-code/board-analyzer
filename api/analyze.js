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
    const { fileType, base64Data, textData } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const messages = fileType === 'pdf' 
      ? [{
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Data
              }
            },
            {
              type: "text",
              text: `Analyze this board document and provide a structured analysis. Return ONLY valid JSON with this exact structure:

{
  "summary": "Brief executive summary of the document",
  "risks": [
    {
      "title": "Risk title",
      "description": "Risk description",
      "severity": "high|medium|low"
    }
  ],
  "decisions": [
    {
      "title": "Decision title",
      "description": "Decision description",
      "status": "approved|pending|discussed"
    }
  ],
  "questions": [
    {
      "title": "Question title",
      "description": "Question description",
      "priority": "high|medium|low"
    }
  ]
}

DO NOT include any text outside the JSON. Ensure the JSON is valid and complete.`
            }
          ]
        }]
      : [{
          role: "user",
          content: `Analyze this board document and provide a structured analysis. Return ONLY valid JSON with this exact structure:

{
  "summary": "Brief executive summary of the document",
  "risks": [
    {
      "title": "Risk title",
      "description": "Risk description",
      "severity": "high|medium|low"
    }
  ],
  "decisions": [
    {
      "title": "Decision title",
      "description": "Decision description",
      "status": "approved|pending|discussed"
    }
  ],
  "questions": [
    {
      "title": "Question title",
      "description": "Question description",
      "priority": "high|medium|low"
    }
  ]
}

DO NOT include any text outside the JSON. Ensure the JSON is valid and complete.

Document content:
${textData}`
        }];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ 
        error: errorData.error?.message || `API Error: ${response.status}` 
      });
    }

    const data = await response.json();
    let responseText = data.content[0].text;
    responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const analysis = JSON.parse(responseText);
    return res.status(200).json(analysis);

  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({ error: error.message });
  }
}
