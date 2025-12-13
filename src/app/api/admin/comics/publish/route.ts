/**
 * Comic Publish API
 *
 * Publishes a comic draft to the comics collection
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore, initAdmin } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

// Initialize Firebase Admin
initAdmin()

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    // Check for admin key authentication
    const adminKey = request.headers.get('X-Admin-Key')
    const expectedAdminKey = process.env.COMIC_SCHEDULER_ADMIN_KEY

    let userId: string

    if (adminKey) {
      // Admin key provided - validate it
      if (!expectedAdminKey) {
        console.error('[ComicPublish] COMIC_SCHEDULER_ADMIN_KEY environment variable not configured')
        return NextResponse.json(
          { error: 'Server misconfiguration: Admin key not set' },
          { status: 500 }
        )
      }
      if (adminKey !== expectedAdminKey) {
        return NextResponse.json({ error: 'Invalid admin key' }, { status: 401 })
      }
      userId = 'comic-scheduler'
    } else {
      // Verify admin authentication
      const session = await getSession()

      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
      const userData = userDoc?.data()
      if (!userData?.isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }

      userId = session.uid
    }

    const body = await request.json()
    const { draftId } = body

    if (!draftId) {
      return NextResponse.json({ error: 'draftId is required' }, { status: 400 })
    }

    // Get the draft
    const draftDoc = await adminFirestore!.collection('comic_drafts').doc(draftId).get()
    if (!draftDoc.exists) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    const draft = draftDoc.data()!

    // Validate draft has required content
    if (!draft.panels || draft.panels.length === 0) {
      return NextResponse.json({ error: 'Draft has no panels' }, { status: 400 })
    }

    // Generate episode ID and slug
    const episodeNumber = draft.episodeNumber || 1
    const episodeId = `${draft.seriesId}-ep${String(episodeNumber).padStart(3, '0')}`
    const slug = `episode-${episodeNumber}`

    // Get first panel image as cover
    const coverImageUrl = draft.panels[0]?.imageUrl || ''

    // Create the published episode
    const episode = {
      id: episodeId,
      seriesId: draft.seriesId,
      slug,
      episodeNumber,
      title: draft.outline?.title || `Episode ${episodeNumber}`,
      titleJa: draft.outline?.titleJa || `第${episodeNumber}話`,
      description: draft.outline?.synopsis || '',
      descriptionJa: draft.outline?.synopsisJa || '',
      coverImageUrl,
      theme: draft.theme,
      location: draft.location,
      panels: draft.panels.map((panel: any, index: number) => ({
        panelNumber: index + 1,
        imageUrl: panel.imageUrl || '',
        imagePrompt: panel.imagePrompt || '',
        sceneDescription: panel.sceneDescription || panel.description || '',
        dialogues: (panel.dialogues || []).map((d: any) => ({
          characterId: d.characterId || 'moshi',
          characterName: d.characterName || 'Moshi',
          textJa: d.textJa || '',
          textEn: d.textEn || '',
          furigana: d.furigana || d.textJa || '',
          audioUrl: d.audioUrl || '',
          bubblePosition: d.bubblePosition || { x: 50, y: 20 },
          bubbleStyle: d.bubbleStyle || 'speech',
          emotion: d.emotion || 'neutral',
        })),
        narration: panel.narration ? {
          textJa: panel.narration.textJa || '',
          textEn: panel.narration.textEn || '',
          audioUrl: panel.narration.audioUrl || '',
        } : null,
        soundEffects: panel.soundEffects || [],
        highlightedVocabulary: panel.highlightedVocabulary || [],
      })),
      vocabulary: draft.vocabulary || [],
      grammarPoints: draft.outline?.learningObjectives || [],
      culturalNotes: draft.culturalNotes || [],
      quiz: draft.quiz || null,
      // Audio fields
      fullAudioUrl: draft.fullAudioUrl || '',
      audioStatus: draft.audioStatus || 'pending',
      audioProvider: draft.audioProvider || 'voicevox',
      metadata: {
        generatedAt: draft.createdAt,
        generatedBy: draft.createdBy || userId,
        aiModel: 'gpt-4o-mini',
        imageModel: 'gemini-2.5-flash-image',
        totalTokensUsed: 0,
        totalImageGenerations: draft.panels.filter((p: any) => p.imageUrl).length,
        estimatedCost: 0,
        generationTimeSeconds: 0,
        isAIGenerated: true,
        characterRefsUsed: draft.characterRef ? ['moshi-master'] : [],
      },
      viewCount: 0,
      completionCount: 0,
      status: 'published',
      publishedAt: new Date(),
      createdAt: draft.createdAt || new Date(),
      updatedAt: new Date(),
    }

    // Save to comics collection
    await adminFirestore!.collection('comics').doc(episodeId).set(episode)

    // Delete the draft after successful publish
    await adminFirestore!.collection('comic_drafts').doc(draftId).delete()
    console.log(`[ComicPublish] Draft deleted: ${draftId}`)

    // Update or create series stats
    const seriesRef = adminFirestore!.collection('comic_series').doc(draft.seriesId)
    const seriesDoc = await seriesRef.get()

    if (seriesDoc.exists) {
      await seriesRef.update({
        publishedEpisodeCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else {
      // Create series document if it doesn't exist
      await seriesRef.set({
        id: draft.seriesId,
        slug: draft.seriesId,
        title: 'Moshi Goes to Japan',
        titleJa: 'もしの日本旅行',
        description: 'Follow Moshi the red panda on adventures across Japan while learning Japanese!',
        descriptionJa: 'レッサーパンダのもしと一緒に日本を冒険しながら日本語を学ぼう！',
        mainCharacterId: 'moshi-master',
        episodeCount: 1,
        publishedEpisodeCount: 1,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    console.log(`[ComicPublish] Episode published: ${episodeId}`)

    return NextResponse.json({
      success: true,
      episodeId,
      slug,
      episodeNumber,
    })
  } catch (error) {
    console.error('Comic publish error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Publish failed' },
      { status: 500 }
    )
  }
}
