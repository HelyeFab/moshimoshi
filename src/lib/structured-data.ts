interface BreadcrumbItem {
  name: string;
  url: string;
}

export const structuredData = {
  website: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Moshimoshi",
    "description": "The ultimate Japanese learning platform: Master verb conjugations, study kanji through JLPT levels and themed mood boards, complete vocabulary sets from Genki and Minna no Nihongo textbooks, practice with Jisho/WaniKani integration, import Anki decks, read NHK news with furigana, enjoy AI-generated stories, practice YouTube shadowing, play interactive learning games, and access comprehensive grammar resources.",
    "url": "https://moshimoshi.app",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://moshimoshi.app/vocabulary?search={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  },

  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Moshimoshi",
    "url": "https://moshimoshi.app",
    "logo": "https://moshimoshi.app/moshimoshi-logo.png",
    "sameAs": [
      "https://twitter.com/moshimoshiapp"
    ]
  },

  educationalApp: {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Moshimoshi",
    "applicationCategory": "EducationalApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "1250"
    }
  },

  breadcrumb: (items: BreadcrumbItem[]) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": `https://moshimoshi.app${item.url}`
    }))
  }),

  faqPage: (faqs: Array<{ question: string; answer: string }>) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  }),

  article: (article: {
    title: string;
    description: string;
    publishedAt: string;
    modifiedAt?: string;
    author?: string;
    imageUrl?: string;
  }) => ({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description,
    "datePublished": article.publishedAt,
    "dateModified": article.modifiedAt || article.publishedAt,
    "author": {
      "@type": "Person",
      "name": article.author || "Moshimoshi Team"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Moshimoshi",
      "logo": {
        "@type": "ImageObject",
        "url": "https://moshimoshi.app/moshimoshi-logo.png"
      }
    },
    "image": article.imageUrl || "https://moshimoshi.app/moshimoshi-logo.png"
  }),

  learningResource: (resource: {
    name: string;
    description: string;
    url: string;
    educationalLevel?: string[];
    teaches?: string[];
  }) => ({
    "@context": "https://schema.org",
    "@type": "LearningResource",
    "name": resource.name,
    "description": resource.description,
    "url": resource.url,
    "educationalLevel": resource.educationalLevel || ["Beginner", "Intermediate", "Advanced"],
    "learningResourceType": "Interactive Resource",
    "teaches": resource.teaches || [],
    "inLanguage": ["en", "ja"],
    "provider": {
      "@type": "Organization",
      "name": "Moshimoshi",
      "url": "https://moshimoshi.app"
    }
  })
};