import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(readFileSync(resolve(__dirname, '../moshimoshi-service-account.json'), 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth();

async function deleteAllUsers() {
  const listAllUsers = async (nextPageToken) => {
    const result = await auth.listUsers(1000, nextPageToken);

    const uids = result.users.map(user => user.uid);
    if (uids.length > 0) {
      await auth.deleteUsers(uids);
      console.log(`Deleted ${uids.length} users`);
    }

    if (result.pageToken) {
      await listAllUsers(result.pageToken);
    }
  };

  await listAllUsers();
  console.log('All users deleted successfully');
}

deleteAllUsers().catch(console.error);
