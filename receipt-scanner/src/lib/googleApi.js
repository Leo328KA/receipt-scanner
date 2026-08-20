// Client-side Google Drive + Sheets integration.
// Uses Google Identity Services (GIS) for OAuth — no backend required for this part.
//
// Setup (see README for full walkthrough):
// 1. Create a project in Google Cloud Console.
// 2. Enable the Drive API and Sheets API.
// 3. Create an OAuth 2.0 Client ID (type: Web application).
// 4. Add your dev URL (e.g. http://localhost:5173, or your StackBlitz preview URL)
//    and your deployed URL to "Authorized JavaScript origins".
// 5. Put the client ID in your .env file as VITE_GOOGLE_CLIENT_ID.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets'

let tokenClient = null
let accessToken = null

// Loads the Google Identity Services script once.
function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export async function signIn() {
  await loadGisScript()

  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) return reject(response)
        accessToken = response.access_token
        resolve(accessToken)
      }
    })
    tokenClient.requestAccessToken()
  })
}

export function isSignedIn() {
  return !!accessToken
}

// Uploads a photo to a specific Drive folder (creates the folder on first run).
export async function uploadReceiptPhoto(blob, filename) {
  const folderId = await getOrCreateFolder('Receipt Scanner')

  const metadata = { name: filename, parents: [folderId] }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', blob)

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  })
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`)
  return res.json() // includes file id
}

async function getOrCreateFolder(name) {
  const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const search = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  }).then((r) => r.json())

  if (search.files?.length) return search.files[0].id

  const created = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' })
  }).then((r) => r.json())

  return created.id
}

// Appends one row per line item (or one summary row) to a Sheet.
// spreadsheetId comes from your .env (VITE_SHEET_ID) — create a blank Sheet first
// and copy the ID out of its URL.
export async function appendToSheet(receipt) {
  const spreadsheetId = import.meta.env.VITE_SHEET_ID
  const range = 'Sheet1!A1'

  const values = (receipt.items?.length ? receipt.items : [{ name: receipt.merchant, price: receipt.total }])
    .map((item) => [receipt.date, receipt.merchant, item.name, item.price])

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    }
  )
  if (!res.ok) throw new Error(`Sheets append failed: ${res.status}`)
  return res.json()
}
