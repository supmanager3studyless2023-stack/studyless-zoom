import { google } from 'googleapis'

const SPREADSHEET_ID = '1ScuZRitxZYykbhtP0TxW17B4V7gBAy1RBr8qzDa0cuU'

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