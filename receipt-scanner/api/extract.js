// Deploy this as a serverless function. Reads the receipt photo, asks Claude
// to extract structured data, and returns it as JSON.
//
// Set ANTHROPIC_API_KEY as an environment variable in your hosting provider's dashboard.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set')
    return res.status(500).json({ error: 'Server misconfigured: missing API key' })
  }

  const { image, mediaType } = req.body || {}

  if (!image) {
    console.error('No image received in request body')
    return res.status(400).json({ error: 'No image provided' })
  }

  const prompt = `Read this receipt photo and return ONLY a JSON object, no other text, in this exact shape:
{
  "merchant": string,
  "date": string (YYYY-MM-DD),
  "total": number,
  "items": [ { "name": string, "price": number } ]
}
If a field is unreadable, use null. Do not include markdown fences.`

  let response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
              { type: 'text', text: prompt }
            ]
          }
        ]
      })
    })
  } catch (err) {
    console.error('Fetch to Anthropic API threw:', err)
    return res.status(502).json({ error: 'Could not reach Claude API' })
  }

  const data = await response.json()

  if (!response.ok) {
    // This surfaces the REAL reason: bad API key, invalid model name, rate limit, etc.
    console.error('Anthropic API returned an error:', response.status, JSON.stringify(data))
    return res.status(502).json({ error: 'Claude API error', detail: data })
  }

  const text = data.content?.map((c) => c.text || '').join('') || ''

  if (!text) {
    console.error('Anthropic API returned no text content:', JSON.stringify(data))
    return res.status(502).json({ error: 'No content returned from Claude' })
  }

  const clean = text.replace(/```json|```/g, '').trim()

  try {
    const parsed = JSON.parse(clean)
    return res.status(200).json(parsed)
  } catch (err) {
    console.error('Failed to parse model output as JSON:', text)
    return res.status(500).json({ error: 'Could not parse receipt', raw: text })
  }
}
