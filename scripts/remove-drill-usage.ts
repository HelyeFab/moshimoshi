import fs from 'node:fs'
import path from 'node:path'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

type ServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
}

function loadServiceAccount(filePath: string): ServiceAccount {
  const resolved = path.resolve(filePath)
  const raw = fs.readFileSync(resolved, 'utf8')
  return JSON.parse(raw) as ServiceAccount
}

async function deleteUsageDocs(userId?: string) {
  const defaultPath = '/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json'
  const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH || defaultPath
  const serviceAccount = loadServiceAccount(serviceAccountPath)

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    })
  }

  const db = getFirestore()
  const usersRef = db.collection('users')

  const userIds: string[] = []
  if (userId) {
    userIds.push(userId)
  } else {
    const usersSnapshot = await usersRef.get()
    usersSnapshot.forEach(doc => userIds.push(doc.id))
  }

  let deletedCount = 0
  for (const uid of userIds) {
    const usageRef = usersRef.doc(uid).collection('usage')
    const usageSnapshot = await usageRef.get()
    const drillDocs = usageSnapshot.docs.filter(doc => doc.id.startsWith('drill_'))

    if (drillDocs.length === 0) {
      continue
    }

    const batch = db.batch()
    drillDocs.forEach(doc => batch.delete(doc.ref))
    await batch.commit()
    deletedCount += drillDocs.length
    console.log(`[remove-drill-usage] Deleted ${drillDocs.length} docs for user ${uid}`)
  }

  console.log(`[remove-drill-usage] Done. Deleted ${deletedCount} total docs.`)
}

const userIdArg = process.argv[2]
deleteUsageDocs(userIdArg).catch(error => {
  console.error('[remove-drill-usage] Failed:', error)
  process.exit(1)
})
