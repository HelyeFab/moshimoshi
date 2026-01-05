import Link from 'next/link'
import { Button } from '@/components/ui/button'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { ArrowRightIcon, PlayIcon, BookOpenIcon, CloudArrowUpIcon, AcademicCapIcon, NewspaperIcon, DocumentTextIcon, ChatBubbleLeftRightIcon, LanguageIcon } from '@heroicons/react/24/outline'
import HeroCarousel from '../client/HeroCarousel'
import { CountdownTimer } from '@/components/waitlist/CountdownTimer'

interface LandingHeroProps {
  isPreLaunch: boolean
  launchDate?: Date
  landingStrings: any
  locale: string
  getLocalePath: (path: string) => string
}

export default function LandingHero({ isPreLaunch, launchDate, landingStrings, locale, getLocalePath }: LandingHeroProps) {
  // Prepare carousel slides (server-side data)
  const carouselSlides = [
    {
      icon: <PlayIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.youtube,
      color: 'from-red-500 to-rose-500',
    },
    {
      icon: <LanguageIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.conjugation,
      color: 'from-blue-500 to-indigo-500',
    },
    {
      icon: <BookOpenIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.kanji,
      color: 'from-purple-500 to-indigo-500',
    },
    {
      icon: <NewspaperIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.news,
      color: 'from-cyan-500 to-blue-500',
    },
    {
      icon: <DocumentTextIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.stories,
      color: 'from-violet-500 to-fuchsia-500',
    },
    {
      icon: <BookOpenIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.library,
      color: 'from-emerald-500 to-teal-500',
    },
    {
      icon: <CloudArrowUpIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.anki,
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: <AcademicCapIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.textbooks,
      color: 'from-orange-500 to-red-500',
    },
    {
      icon: <ChatBubbleLeftRightIcon className="w-12 h-12" />,
      ...landingStrings.hero.carousel.comics,
      color: 'from-pink-500 to-rose-500',
    },
  ]

  return (
    <section className="relative pt-24 md:pt-32 pb-16 md:pb-24 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-900 dark:via-purple-900 dark:to-pink-900" />

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-white/10 rounded-full blur-3xl -top-48 -left-48 animate-pulse" />
        <div className="absolute w-96 h-96 bg-white/10 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text Content */}
          <div className="text-white space-y-6">
            {/* Mascot */}
            <div className="flex justify-center lg:justify-start mb-6">
              <DoshiMascot size="large" />
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              {landingStrings.hero.title}
            </h1>

            <p className="text-lg md:text-xl text-white/90">
              {landingStrings.hero.subtitle}
            </p>

            {/* Pre-launch Countdown or CTA Buttons */}
            {isPreLaunch && launchDate ? (
              <div className="space-y-4">
                <CountdownTimer targetDate={launchDate} />
                <p className="text-white/80 text-sm">
                  {landingStrings.hero.preLaunch?.countdownSubtext || 'Join our waitlist and get 25% off at launch'}
                </p>
                <Link href={getLocalePath('/waitlist')}>
                  <Button className="bg-white text-indigo-600 hover:bg-gray-100 text-lg py-6 px-8 rounded-lg shadow-2xl w-full sm:w-auto">
                    {landingStrings.hero.preLaunch?.joinWaitlistDiscount || 'Join Waitlist - Get 25% Off'}
                    <ArrowRightIcon className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href={getLocalePath('/auth/signup')} className="w-full sm:w-auto">
                  <Button className="bg-white text-indigo-600 hover:bg-gray-100 text-lg py-6 px-8 rounded-lg shadow-2xl w-full">
                    {landingStrings.hero.cta?.getStarted || 'Get Started'}
                    <ArrowRightIcon className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href={getLocalePath('/auth/signin')} className="w-full sm:w-auto">
                  <Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 text-lg py-6 px-8 rounded-lg backdrop-blur-sm w-full">
                    {landingStrings.hero.cta?.signIn || 'Sign In'}
                  </Button>
                </Link>
              </div>
            )}

            {/* Trust Indicators */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 text-sm text-white/80 pt-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {landingStrings.hero.trust?.free || 'Free to start'}
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {landingStrings.hero.trust?.noCredit || 'No credit card required'}
              </div>
            </div>
          </div>

          {/* Right: Carousel */}
          <div className="relative">
            <HeroCarousel slides={carouselSlides} />
          </div>
        </div>
      </div>
    </section>
  )
}
