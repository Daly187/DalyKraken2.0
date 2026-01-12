import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import https from 'https';

const serviceAccount = JSON.parse(
  readFileSync('serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function createIndex() {
  try {
    console.log('Getting access token...');
    const accessToken = await admin.credential.applicationDefault().getAccessToken();

    const indexConfig = {
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'botId', order: 'ASCENDING' },
        { fieldPath: 'timestamp', order: 'DESCENDING' }
      ]
    };

    const postData = JSON.stringify(indexConfig);

    const options = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: '/v1/projects/dalydough/databases/(default)/collectionGroups/botExecutions/indexes',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.access_token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('Creating index via Firestore API...');

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('Response status:', res.statusCode);
        console.log('Response:', data);

        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('✅ Index creation initiated successfully!');
          console.log('The index is now building and should be ready in a few minutes.');
        } else if (res.statusCode === 409) {
          console.log('ℹ️  Index already exists or is being created.');
        } else {
          console.log('❌ Failed to create index');
        }
        process.exit(0);
      });
    });

    req.on('error', (error) => {
      console.error('Error:', error);
      process.exit(1);
    });

    req.write(postData);
    req.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createIndex();
