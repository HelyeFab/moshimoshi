/**
 * Panel Regeneration API
 * Regenerates a specific panel for a published comic episode
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore, initAdmin } from '@/lib/firebase/admin'

initAdmin()

export const runtime = 'nodejs'
export const maxDuration = 120 // 2 minutes for image generation

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
    const userData = userDoc?.data()
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { episodeId, panelNumber, customPrompt } = body

    if (!episodeId || !panelNumber) {
      return NextResponse.json(
        { error: 'episodeId and panelNumber are required' },
        { status: 400 }
      )
    }

    console.log(`[RegeneratePanel] Starting regeneration for ${episodeId} panel ${panelNumber}`)

    // 1. Get the published comic
    const comicDoc = await adminFirestore!.collection('comics').doc(episodeId).get()
    if (!comicDoc.exists) {
      return NextResponse.json({ error: 'Comic episode not found' }, { status: 404 })
    }

    const comic = comicDoc.data()!
    const panel = comic.panels?.[panelNumber - 1]

    if (!panel) {
      return NextResponse.json({ error: `Panel ${panelNumber} not found` }, { status: 404 })
    }

    // 2. Load character references from Firestore
    // For now, hardcode the main characters (this could be dynamic based on panel.characters)
    const characterIds = ['moshi-master', 'yuki-sloth']
    const characterRefs: any[] = []

    for (const charId of characterIds) {
      const charDoc = await adminFirestore!.collection('saved_characters').doc(charId).get()
      if (charDoc.exists) {
        const data = charDoc.data()!
        characterRefs.push({
          id: charId,
          name: data.name || charId,
          nameJa: data.nameJa || '',
          role: data.role || 'friend',
          visualDescription: data.visualDescription || '',
          personality: data.personality || '',
          speakingStyle: data.speakingStyle || '',
          imageUrl: data.referenceImageUrl || '',
        })
      }
    }

    console.log(`[RegeneratePanel] Loaded ${characterRefs.length} character references`)

    // 3. Create temporary draft
    const draftId = `comic_draft_regen_${Date.now()}`

    await adminFirestore!.collection('comic_drafts').doc(draftId).set({
      seriesId: comic.seriesId || 'moshi-goes-to-japan',
      episodeNumber: comic.episodeNumber || 1,
      theme: comic.theme || '',
      location: comic.location || '',
      jlptLevel: comic.jlptLevel || 'N5',
      characterIds: characterIds,
      outline: {
        title: comic.title,
        titleJa: comic.titleJa,
      },
      characterSheet: {
        mainCharacter: characterRefs.find(c => c.id === 'moshi-master'),
        supportingCharacters: characterRefs.filter(c => c.id !== 'moshi-master'),
        allCharacters: characterRefs,
      },
      characterRefs: characterRefs.map(c => ({
        id: c.id,
        name: c.name,
        imageUrl: c.imageUrl,
      })),
      panels: comic.panels,
      status: 'generating',
      currentStep: 'images',
      progress: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: session.uid,
    })

    console.log(`[RegeneratePanel] Draft created: ${draftId}`)

    // 4. Call internal generation API
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const generateResponse = await fetch(`${appUrl}/api/admin/comics/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        step: 'panel_image',
        draftId: draftId,
        panelNumber: panelNumber,
        characterRefs: characterRefs.map(c => ({
          id: c.id,
          name: c.name,
          imageUrl: c.imageUrl,
        })),
      }),
    })

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text()
      console.error(`[RegeneratePanel] Generation failed:`, errorText)

      // Clean up draft
      await adminFirestore!.collection('comic_drafts').doc(draftId).delete()

      throw new Error(`Image generation failed: ${errorText}`)
    }

    const generateResult = await generateResponse.json()

    if (!generateResult.success) {
      // Clean up draft
      await adminFirestore!.collection('comic_drafts').doc(draftId).delete()

      throw new Error(generateResult.error || 'Image generation failed')
    }

    console.log(`[RegeneratePanel] Panel image generated:`, generateResult.imageUrl)

    // 5. Get updated panel from draft
    const updatedDraftDoc = await adminFirestore!.collection('comic_drafts').doc(draftId).get()
    const updatedDraft = updatedDraftDoc.data()
    const updatedPanel = updatedDraft?.panels[panelNumber - 1]

    // 6. Update published comic with new panel
    const updatedPanels = [...comic.panels]
    updatedPanels[panelNumber - 1] = {
      ...updatedPanels[panelNumber - 1],
      imageUrl: updatedPanel.imageUrl,
      imagePrompt: updatedPanel.imagePrompt,
    }

    await adminFirestore!.collection('comics').doc(episodeId).update({
      panels: updatedPanels,
      updatedAt: new Date(),
    })

    console.log(`[RegeneratePanel] Episode updated with new panel`)

    // 7. Clean up draft
    await adminFirestore!.collection('comic_drafts').doc(draftId).delete()
    console.log(`[RegeneratePanel] Draft deleted: ${draftId}`)

    return NextResponse.json({
      success: true,
      episodeId,
      panelNumber,
      imageUrl: updatedPanel.imageUrl,
      oldImageUrl: panel.imageUrl,
    })
  } catch (error) {
    console.error('[RegeneratePanel] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Regeneration failed' },
      { status: 500 }
    )
  }
}
