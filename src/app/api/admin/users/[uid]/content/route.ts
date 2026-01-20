import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export const GET = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 })
    }

    const { uid } = context.params || {}
    if (!uid) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get user ID (support both UID and email)
    let userId: string
    try {
      const userRecord = await adminAuth.getUser(uid)
      userId = userRecord.uid
    } catch {
      try {
        const userRecord = await adminAuth.getUserByEmail(uid)
        userId = userRecord.uid
      } catch {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    }

    // 1. Get Anki decks
    const ankiDecksSnapshot = await adminDb
      .collection('flashcardDecks')
      .where('userId', '==', userId)
      .where('source', '==', 'anki')
      .get()

    const ankiDecks = ankiDecksSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      cardCount: doc.data().cards?.length || doc.data().cardCount || 0,
      createdAt: doc.data().createdAt,
      lastModified: doc.data().lastModified
    }))

    // Check Anki metadata
    const ankiMetadataDoc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('metadata')
      .doc('ankiDecks')
      .get()

    const ankiMetadata = ankiMetadataDoc.exists ? ankiMetadataDoc.data() : null

    // 2. Get custom lists
    const listsSnapshot = await adminDb
      .collection('users')
      .doc(userId)
      .collection('lists')
      .get()

    const customLists = listsSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      itemCount: doc.data().items?.length || 0,
      createdAt: doc.data().createdAt,
      lastModified: doc.data().lastModified
    }))

    // 3. List all user subcollections
    const userRef = adminDb.collection('users').doc(userId)
    const collections = await userRef.listCollections()

    const subcollections: Array<{ name: string; documentCount: number; sampleDocs: string[] }> = []

    for (const collection of collections) {
      const snapshot = await collection.limit(5).get()
      subcollections.push({
        name: collection.id,
        documentCount: snapshot.size, // Note: this is limited to 5, actual count may be higher
        sampleDocs: snapshot.docs.map((doc) => doc.id)
      })
    }

    const response = {
      userId,
      anki: {
        deckCount: ankiDecks.length,
        totalCards: ankiDecks.reduce((sum, deck) => sum + deck.cardCount, 0),
        decks: ankiDecks,
        metadata: ankiMetadata
      },
      lists: {
        count: customLists.length,
        totalItems: customLists.reduce((sum, list) => sum + list.itemCount, 0),
        lists: customLists
      },
      subcollections
    }

    return NextResponse.json({ success: true, data: response })
  } catch (error: any) {
    console.error('[Admin API] Error fetching user content:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user content' },
      { status: 500 }
    )
  }
})
