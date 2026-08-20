// Deploy this as a serverless function (this file structure works directly on Vercel;
// for Cloudflare/Netlify you'd adapt the export signature slightly — same logic).
//
// It receives a base64 receipt photo from the browser, asks Claude to read it,
// and returns clean structured JSON. Keeping the API key here (not in the browser)
// is the whole reason this piece is server-side.
//
// Set ANTHROPIC_API_KEY as an environment variable in your hosting provider's dashboard.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { image, mediaType } = req.body

  const prompt = `Read this receipt photo and return ONLY a JSON object, no other text, in this exact shape:
{
  "merchant": string,
  "date": string (YYYY-MM-DD),
  "total": number,
  "items": [ { "name": string, "price": number } ]
}
If a field is unreadable, use null. Do not include markdown fences.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
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

  const data = await response.json()
  const text = data.content?.map((c) => c.text || '').join('') || '{}'
  const clean = text.replace(/```json|```/g, '').trim()

  try {
    const parsed = JSON.parse(clean)
    return res.status(200).json(parsed)
  } catch (err) {
    console.error('Failed to parse model output:', text)
    return res.status(500).json({ error: 'Could not parse receipt' })
  }
}
