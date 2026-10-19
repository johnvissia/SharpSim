const { GoogleAuth } = require('google-auth-library');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function testAuth() {
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });

  try {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    console.log('SUCCESS! Access token retrieved:', token.token?.substring(0, 20) + '...');
  } catch (err) {
    console.error('Auth error status:', err.status);
    console.error('Auth error message:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
    }
  }
}

testAuth();
