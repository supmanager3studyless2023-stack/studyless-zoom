import { google } from 'googleapis'

const SPREADSHEET_ID = '1ScuZRitxZYykbhtP0TxW17B4V7gBAy1RBr8qzDa0cuU'
const FEEDBACK_SHEET = 'Feedbacks'

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

export async function appendToSheet(sheetName: string, values: any[]) {
  const auth = await getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:AC`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  })
}

async function ensureFeedbackSheet() {
  const auth = await getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: FEEDBACK_SHEET } } }],
      },
    })
  } catch {
    // sheet already exists
  }
}

export async function storeFeedbackHtml(
  id: string,
  html: string,
  managerName: string,
  studentName: string
): Promise<void> {
  await ensureFeedbackSheet()
  const auth = await getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${FEEDBACK_SHEET}!A:D`,
    valueInputOption: 'RAW',
    requestBody: { values: [[id, html, managerName, studentName]] },
  })
}

export async function getFeedbackHtml(id: string): Promise<string | null> {
  const auth = await getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${FEEDBACK_SHEET}!A:B`,
  })
  const rows = (res.data.values as string[][] | null) ?? []
  const row = rows.find(r => r[0] === id)
  return row?.[1] ?? null
}
