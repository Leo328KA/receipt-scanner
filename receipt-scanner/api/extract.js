// Deploy this as a serverless function. Reads the receipt photo, asks Gemini
// to extract structured data, and returns it as JSON.
//
// Get a free API key (no credit card needed) at https://aistudio.google.com/apikey
// Set GEMINI_API_KEY as an environment variable in your hosting provider's dashboard.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set')
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
    response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inline_data: { mime_type: mediaType || 'image/jpeg', data: image } },
                { text: prompt }
              ]
            }
          ]
        })
      }
    )
  } catch (err) {
    console.error('Fetch to Gemini API threw:', err)
    return res.status(502).json({ error: 'Could not reach Gemini API' })
  }

  const data = await response.json()

  if (!response.ok) {
    // Surfaces the real reason: bad API key, quota exceeded, invalid request, etc.
    console.error('Gemini API returned an error:', response.status, JSON.stringify(data))
    return res.status(502).json({ error: 'Gemini API error', detail: data })
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''

  if (!text) {
    console.error('Gemini API returned no text content:', JSON.stringify(data))
    return res.status(502).json({ error: 'No content returned from Gemini' })
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
