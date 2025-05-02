const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

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

// Получение токенов
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

// Чтение диапазона
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

// Чтение структуры
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

// Добавление данных
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

// Обновление диапазона (replace)
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

// batchUpdate для структуры или форматирования
app.post('/sheets/:spreadsheetId/batchUpdate', async (req, res) => {
  if (!tokens) return res.status(401).send('Not authorized');
  try {
    oauth2Client.setCredentials(tokens);
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: req.params.spreadsheetId,
      requestBody: {
        requests: req.body.requests
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send('BatchUpdate error: ' + error.message);
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
