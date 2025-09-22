import { Metadata } from 'next';

interface SEOPageConfig {
  title: string;
  description: string;
  keywords?: string[];
  path?: string;
  image?: string;
  type?: 'website' | 'article';
  structuredData?: any;
}

const siteConfig = {
  name: 'Moshimoshi',
  url: 'https://moshimoshi.app',
  description: 'The ultimate Japanese learning platform: Master verb conjugations, study kanji through JLPT levels and mood boards, practice with Jisho/WaniKani vocabulary, import Anki decks, read news articles and AI stories, practice YouTube shadowing, play learning games, access grammar resources, and build fluency with our comprehensive suite of interactive tools.',
  image: '/moshimoshi-logo.png',
  twitter: '@moshimoshiapp',
};

export function generatePageMetadata(config: SEOPageConfig): Metadata {
  const {
    title,
    description,
    keywords = [],
    path = '',
    image = siteConfig.image,
    type = 'website',
  } = config;

  const url = `${siteConfig.url}${path}`;
  const fullTitle = title.includes('Moshimoshi') ? title : `${title} | ${siteConfig.name}`;

  const metadata: Metadata = {
    title: fullTitle,
    description,
    keywords: keywords.length > 0 ? keywords : undefined,
    authors: [{ name: 'Moshimoshi Team' }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: siteConfig.name,
      images: [
        {
          url: `${siteConfig.url}${image}`,
          width: 1200,
          height: 630,
          alt: `${siteConfig.name} - Japanese Learning App`,
        },
      ],
      locale: 'en_US',
      type,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [`${siteConfig.url}${image}`],
      creator: siteConfig.twitter,
    },
    alternates: {
      canonical: url,
    },
  };

  return metadata;
}

// Structured data generators
export const structuredData = {
  organization: {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    url: siteConfig.url,
    logo: `${siteConfig.url}${siteConfig.image}`,
    sameAs: [
      `https://twitter.com/${siteConfig.twitter.replace('@', '')}`,
    ],
  },

  website: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteConfig.url}/vocabulary?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  },

  educationalApp: {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteConfig.name,
    applicationCategory: 'EducationApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '1250',
    },
  },

  course: (courseName: string, description: string) => ({
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: courseName,
    description,
    provider: {
      '@type': 'Organization',
      name: siteConfig.name,
      sameAs: siteConfig.url,
    },
  }),

  faqPage: (faqs: Array<{ question: string; answer: string }>) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }),

  learningResource: (data: {
    name: string;
    description: string;
    url: string;
    learningResourceType?: string;
    educationalLevel?: string;
    inLanguage?: string;
    teaches?: string;
  }) => ({
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: data.name,
    description: data.description,
    url: `${siteConfig.url}${data.url}`,
    learningResourceType: data.learningResourceType || 'Interactive content',
    educationalLevel: data.educationalLevel || 'Beginner to Advanced',
    inLanguage: data.inLanguage || 'en',
    teaches: data.teaches || 'Japanese Language',
    provider: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteConfig.url,
    },
  }),

  breadcrumb: (items: Array<{ name: string; url: string }>) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${siteConfig.url}${item.url}`,
    })),
  }),
};