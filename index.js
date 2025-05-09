const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

app.use('/.well-known', express.static('.well-known'));
app.use(express.static('.')); // для openapi.yaml и logo.png

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

let tokens = null;

// Авторизация
app.get('/auth', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: process.env.SCOPES.split(' ')
  });
  res.redirect(url);
});

app.get('/oauth2callback', async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens: newTokens } = await oauth2Client.getToken(code);
    tokens = newTokens;
    oauth2Client.setCredentials(tokens);
    res.send('Authorization successful!');
  } catch (error) {
    res.status(500).send('OAuth error: ' + error.message);
  }
});

// Чтение данных
app.get('/sheets/:spreadsheetId', async (req, res) => {
  if (!tokens) return res.status(401).send('Not authorized');
  try {
    oauth2Client.setCredentials(tokens);
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const range = req.query.range || 'Sheet1';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: req.params.spreadsheetId,
      range,
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send('Read error: ' + error.message);
  }
});

// Структура таблицы
app.get('/sheets/:spreadsheetId/structure', async (req, res) => {
  if (!tokens) return res.status(401).send('Not authorized');
  try {
    oauth2Client.setCredentials(tokens);
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const response = await sheets.spreadsheets.get({
      spreadsheetId: req.params.spreadsheetId
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send('Structure error: ' + error.message);
  }
});

// Добавление строк
app.post('/sheets/:spreadsheetId', async (req, res) => {
  if (!tokens) return res.status(401).send('Not authorized');
  try {
    oauth2Client.setCredentials(tokens);
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const range = req.body.range || 'Sheet1';
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: req.params.spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: req.body.values,
      },
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send('Append error: ' + error.message);
  }
});

// Обновление значений
app.post('/sheets/:spreadsheetId/update', async (req, res) => {
  if (!tokens) return res.status(401).send('Not authorized');
  try {
    oauth2Client.setCredentials(tokens);
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const { range, values } = req.body;
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: req.params.spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send('Update error: ' + error.message);
  }
});

// Универсальный batchUpdate
app.post('/batchUpdate', async (req, res) => {
  if (!tokens) return res.status(401).send('Not authorized');
  try {
    const { spreadsheetId, requests, requestBody } = req.body;
    const finalRequests = requests || requestBody?.requests;

    if (!spreadsheetId || !Array.isArray(finalRequests)) {
      return res.status(400).send('Missing spreadsheetId or requests');
    }

    oauth2Client.setCredentials(tokens);
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: finalRequests }
    });

    res.status(204).end();
  } catch (error) {
    console.error('BatchUpdate error:', error.response?.data || error.message);
    res.status(500).send('BatchUpdate error: ' + (error.response?.data?.error?.message || error.message));
  }
});

// ✅ Новый: вставка формул
app.post('/insertFormulaColumn', async (req, res) => {
  if (!tokens) return res.status(401).send('Not authorized');
  try {
    const { spreadsheetId, formulas, startRow, columnIndex } = req.body;

    if (!spreadsheetId || !Array.isArray(formulas) || startRow == null || columnIndex == null) {
      return res.status(400).send('Missing parameters');
    }

    const rows = formulas.map(formula => ({
      values: [{
        userEnteredValue: formula.startsWith('=') ? { formulaValue: formula } : { stringValue: formula }
      }]
    }));

    oauth2Client.setCredentials(tokens);
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    const request = {
      spreadsheetId,
      requestBody: {
        requests: [{
          updateCells: {
            range: {
              sheetId: 0,
              startRowIndex: startRow,
              endRowIndex: startRow + formulas.length,
              startColumnIndex: columnIndex,
              endColumnIndex: columnIndex + 1
            },
            rows,
            fields: 'userEnteredValue'
          }
        }]
      }
    };

    const response = await sheets.spreadsheets.batchUpdate(request);
    res.json(response.data);
  } catch (error) {
    res.status(500).send('InsertFormula error: ' + error.message);
  }
});

// Создание новой таблицы
app.post('/sheets', async (req, res) => {
  if (!tokens) return res.status(401).send('Not authorized');
  try {
    oauth2Client.setCredentials(tokens);
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const resource = {
      properties: {
        title: req.body.title || 'New Sheet',
      },
    };
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: resource,
    });
    res.json(spreadsheet.data);
  } catch (error) {
    res.status(500).send('Create error: ' + error.message);
  }
});

// Запуск сервера
app.listen(3000, () => console.log('Server started on port 3000'));
