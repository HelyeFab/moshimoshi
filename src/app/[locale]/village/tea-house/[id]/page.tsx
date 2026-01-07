import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getQuestion } from '@/lib/qa/questions'
import { getTranslations } from '@/i18n/server'
import type { Locale } from '@/i18n/routing'
import QuestionDetailClient from './QuestionDetailClient'

type Props = {
  params: Promise<{ id: string; locale: Locale }>
}

/**
 * Generate metadata for individual question pages
 * Provides SEO-optimized title, description, and social media cards
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params
  try {
    const question = await getQuestion(id)

    if (!question) {
      return {
        title: 'Question Not Found | Moshimoshi',
      }
    }

    const { strings } = await getTranslations(locale)
    const title = `${question.title} | ${strings.qa.title} | Moshimoshi`
    const description = question.content.slice(0, 160).replace(/\n/g, ' ') + '...'

    return {
      title,
      description,
      keywords: [
        'Japanese learning',
        'Japanese question',
        'learn Japanese',
        'Japanese language help',
        ...question.tags.map(tag => `Japanese ${tag}`),
      ],
      openGraph: {
        title: question.title,
        description,
        type: 'article',
        locale: locale,
        siteName: 'Moshimoshi',
        publishedTime: question.createdAt,
        modifiedTime: question.updatedAt !== question.createdAt ? question.updatedAt : undefined,
        authors: [question.author.name],
        tags: question.tags,
      },
      twitter: {
        card: 'summary',
        title: question.title,
        description,
      },
      alternates: {
        canonical: `https://moshimoshi.app/${locale}/village/tea-house/${id}`,
      },
    }
  } catch (error) {
    console.error('Error generating metadata:', error)
    return {
      title: 'Question | Moshimoshi',
    }
  }
}

/**
 * Question Detail Page (Server Component)
 * Fetches question data and renders client component with SEO optimization
 */
export default async function QuestionDetailPage({ params }: Props) {
  const { id } = await params
  let question
  try {
    question = await getQuestion(id)
  } catch (error) {
    console.error('Error fetching question:', error)
    notFound()
  }

  if (!question) {
    notFound()
  }

  // Generate structured data for SEO (QAPage schema)
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    mainEntity: {
      '@type': 'Question',
      name: question.title,
      text: question.content,
      answerCount: question.answerCount,
      upvoteCount: question.upvotes,
      dateCreated: question.createdAt,
      dateModified: question.updatedAt !== question.createdAt ? question.updatedAt : undefined,
      author: {
        '@type': 'Person',
        name: question.author.name,
      },
    },
  }

  return (
    <>
      {/* Structured Data (JSON-LD) for rich search results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Client component with all interactivity */}
      <QuestionDetailClient questionId={id} />
    </>
  )
}
