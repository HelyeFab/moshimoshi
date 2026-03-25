import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/admin/adminAuth'
import { findKanjiByCharacterFromDisk } from '@/lib/kanji/kanjiData.server'
import {
  getLexicalityReviewQueue,
  getKanjiStudyOutcomesSummary,
  inspectKanjiVocabulary,
  validateProposalLevel,
} from '@/lib/kanji/kanjiVocabularyInspector'

export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const kanji = searchParams.get('kanji')?.trim()
    const proposalLevel = searchParams.get('proposalLevel')?.trim().toUpperCase() as
      | 'N3'
      | 'N2'
      | 'N1'
      | undefined
    const queue = searchParams.get('queue')?.trim().toLowerCase()
    const report = searchParams.get('report')?.trim().toLowerCase()

    if (report === 'outcomes') {
      const days = Math.max(1, Math.min(Number(searchParams.get('days')) || 14, 90))
      const summary = await getKanjiStudyOutcomesSummary(days)
      return NextResponse.json({
        mode: 'outcomes-summary',
        summary,
      })
    }

    if (queue === 'lexicality') {
      const items = await getLexicalityReviewQueue()
      return NextResponse.json({
        mode: 'lexicality-review-queue',
        items,
      })
    }

    if (proposalLevel) {
      if (!['N3', 'N2', 'N1'].includes(proposalLevel)) {
        return NextResponse.json({ error: 'Unsupported proposal level' }, { status: 400 })
      }

      const validations = await validateProposalLevel(proposalLevel)
      return NextResponse.json({
        mode: 'proposal-validation',
        level: proposalLevel,
        validations,
      })
    }

    if (!kanji) {
      return NextResponse.json({ error: 'Query parameter "kanji" is required' }, { status: 400 })
    }

    const kanjiData = await findKanjiByCharacterFromDisk(kanji)
    if (!kanjiData) {
      return NextResponse.json({ error: `Kanji "${kanji}" not found` }, { status: 404 })
    }

    const inspection = await inspectKanjiVocabulary(kanjiData)
    return NextResponse.json({
      mode: 'single-kanji',
      inspection,
    })
  } catch (error) {
    console.error('[API /admin/kanji-vocabulary-inspector] Error:', error)
    return NextResponse.json(
      { error: 'Failed to inspect kanji vocabulary candidates' },
      { status: 500 }
    )
  }
})
