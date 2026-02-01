import type { Metadata } from 'next'
import { buildGrammarHubMetadata, renderGrammarHubPage } from '../../grammarHub'

export const dynamic = 'force-static'
export const runtime = 'nodejs'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildGrammarHubMetadata(locale, 'n4', 'practice')
}

export default async function GrammarPracticeN4Page({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return renderGrammarHubPage(locale, 'n4', 'practice')
}
