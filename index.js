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

app.get('/auth', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: process.env.SCOPES.split(' ')
  });
  res.redirect(url);
});

app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  const { tokens: newTokens } = await oauth2Client.getToken(code);
  tokens = newTokens;
  oauth2Client.setCredentials(tokens);
  res.send('Authorization successful!');
});

app.get('/sheets/:spreadsheetId', async (req, res) => {
  oauth2Client.setCredentials(tokens);
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: req.params.spreadsheetId,
    range: 'Sheet1',
  });
  res.json(data.data);
});

app.post('/sheets/:spreadsheetId', async (req, res) => {
  oauth2Client.setCredentials(tokens);
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: req.params.spreadsheetId,
    range: 'Sheet1',
    valueInputOption: 'RAW',
    requestBody: {
      values: req.body.values,
    },
  });
  res.json(response.data);
});

app.post('/sheets', async (req, res) => {
  oauth2Client.setCredentials(tokens);
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const resource = {
    properties: {
      title: req.body.title || 'New Sheet',
    },
  };

  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: resource,
  });

  res.json(spreadsheet.data);
});

app.listen(3000, () => console.log('Server started on port 3000'));
