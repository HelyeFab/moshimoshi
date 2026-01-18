// Client-side Firebase configuration (legacy entrypoint)
// Exposes initialized instances from firebase/client to avoid duplicate setup.

export { firebaseConfig } from './config-base'
export { app, auth, db, firestore } from './client'
