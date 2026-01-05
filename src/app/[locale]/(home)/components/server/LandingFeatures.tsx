import { Card } from '@/components/ui/FeatureCard'
import {
  PlayIcon,
  BookOpenIcon,
  CloudArrowUpIcon,
  AcademicCapIcon,
  NewspaperIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  LanguageIcon
} from '@heroicons/react/24/outline'

interface LandingFeaturesProps {
  landingStrings: any
}

export default function LandingFeatures({ landingStrings }: LandingFeaturesProps) {
  const features = [
    {
      icon: <PlayIcon className="w-8 h-8" />,
      title: landingStrings.features?.youtube?.title || 'YouTube Shadowing',
      description: landingStrings.features?.youtube?.description || 'Practice pronunciation with native speakers',
      color: 'from-red-500 to-rose-500',
    },
    {
      icon: <LanguageIcon className="w-8 h-8" />,
      title: landingStrings.features?.conjugation?.title || 'Conjugation Engine',
      description: landingStrings.features?.conjugation?.description || 'Master verb conjugations',
      color: 'from-blue-500 to-indigo-500',
    },
    {
      icon: <BookOpenIcon className="w-8 h-8" />,
      title: landingStrings.features?.kanji?.title || 'Kanji Connection',
      description: landingStrings.features?.kanji?.description || 'Learn kanji through visual patterns',
      color: 'from-purple-500 to-indigo-500',
    },
    {
      icon: <NewspaperIcon className="w-8 h-8" />,
      title: landingStrings.features?.news?.title || 'News Articles',
      description: landingStrings.features?.news?.description || 'Read authentic Japanese news',
      color: 'from-cyan-500 to-blue-500',
    },
    {
      icon: <DocumentTextIcon className="w-8 h-8" />,
      title: landingStrings.features?.stories?.title || 'AI Stories',
      description: landingStrings.features?.stories?.description || 'Practice with generated stories',
      color: 'from-violet-500 to-fuchsia-500',
    },
    {
      icon: <CloudArrowUpIcon className="w-8 h-8" />,
      title: landingStrings.features?.anki?.title || 'Anki Import',
      description: landingStrings.features?.anki?.description || 'Import your Anki decks',
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: <AcademicCapIcon className="w-8 h-8" />,
      title: landingStrings.features?.textbooks?.title || 'Textbook Vocabulary',
      description: landingStrings.features?.textbooks?.description || 'Study Genki & Minna no Nihongo',
      color: 'from-orange-500 to-red-500',
    },
    {
      icon: <ChatBubbleLeftRightIcon className="w-8 h-8" />,
      title: landingStrings.features?.comics?.title || 'Moshi Comics',
      description: landingStrings.features?.comics?.description || 'Read interactive comics',
      color: 'from-pink-500 to-rose-500',
    },
  ]

  return (
    <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {landingStrings.features?.title || 'Everything You Need to Master Japanese'}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {landingStrings.features?.subtitle || 'A comprehensive platform with all the tools you need'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-2xl transition-shadow"
            >
              <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${feature.color} text-white mb-4`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
