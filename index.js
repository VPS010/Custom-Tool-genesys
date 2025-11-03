require('dotenv').config();
const express = require('express');
const axios = require('axios');
const Joi = require('joi');

const app = express();
app.use(express.json({ limit: '500kb' }));

// Config
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.GENESYS_CLIENT_ID;
const CLIENT_SECRET = process.env.GENESYS_CLIENT_SECRET;
const REGION = process.env.GENESYS_REGION;
const CONTACT_LIST_ID = process.env.CONTACT_LIST_ID;
const TOKEN_BUFFER = Number(process.env.TOKEN_EXPIRY_BUFFER_SECONDS || 30);

// Validation
if (!CLIENT_ID || !CLIENT_SECRET || !CONTACT_LIST_ID) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Token cache
let tokenCache = { accessToken: null, expiresAt: 0 };

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.accessToken && tokenCache.expiresAt - TOKEN_BUFFER > now) {
    return tokenCache.accessToken;
  }

  const tokenUrl = `https://login.${REGION}.pure.cloud/oauth/token`;
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  try {
    const res = await axios.post(tokenUrl, 'grant_type=client_credentials', {
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    tokenCache.accessToken = res.data.access_token;
    tokenCache.expiresAt = Math.floor(Date.now() / 1000) + Number(res.data.expires_in);
    return tokenCache.accessToken;
  } catch (err) {
    console.error('Token error:', err.response?.data || err.message);
    throw err;
  }
}

// Validation schema
const leadSchema = Joi.object({
  firstName: Joi.string().allow('', null),
  lastName: Joi.string().allow('', null),
  email: Joi.string().email().allow('', null),
  phone: Joi.string().allow('', null),
  dropdown1: Joi.string().allow('', null),
  dropdown2: Joi.string().allow('', null),
  dropdown3: Joi.string().allow('', null),
  message: Joi.string().allow('', null)
});

function buildGenesysPayload(leadData) {
  return [{
    data: {
      name: `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim() || 'Unknown',
      email: leadData.email || '',
      phone: leadData.phone || '',
      refReason1: leadData.dropdown1 || '',
      refReason2: leadData.dropdown2 || '',
      notes: leadData.message || '',
      formType: 'Chatbot Form Fill',
      sourceURL: leadData.dropdown3 || ''
    }
  }];
}

app.post('/push-to-genesys', async (req, res) => {
  const { error, value } = leadSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message });
  }

  const payload = buildGenesysPayload(value);
  const url = `https://api.${REGION}.pure.cloud/api/v2/outbound/contactlists/${CONTACT_LIST_ID}/contacts`;

  try {
    const token = await getAccessToken();
    console.log('Sending payload:', JSON.stringify(payload, null, 2));
    const resp = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    res.json({ success: true, genesysResponse: resp.data });
  } catch (err) {
    console.error('Genesys error:', err.response?.data || err.message);
    res.status(500).json({ 
      success: false, 
      error: {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data
      }
    });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/', (req, res) => res.send('Yes, Tool is up and running...:)'));

app.listen(PORT, () => {
  console.log(`Genesys contact pusher running on port ${PORT}`);
});