# LANDING PAGE DESIGN SPEC (SOLO)
## Single Optimized Landing Overview - Moshimoshi Japanese Learning Platform

**Version:** 1.0
**Date:** 2025-10-30
**Target:** Senior Front-End Developer
**File Location:** `/src/app/(public)/landing/page.tsx`
**Implementation Time:** 8-12 hours

---

## TABLE OF CONTENTS
1. [Executive Summary](#executive-summary)
2. [SEO & Conversion Strategy](#seo--conversion-strategy)
3. [Component Architecture](#component-architecture)
4. [Section-by-Section Specifications](#section-by-section-specifications)
5. [Visual Design System](#visual-design-system)
6. [Interaction & Animation Patterns](#interaction--animation-patterns)
7. [Responsive Design Specifications](#responsive-design-specifications)
8. [Performance Optimization](#performance-optimization)
9. [Accessibility Requirements](#accessibility-requirements)
10. [Technical Implementation Guide](#technical-implementation-guide)
11. [Testing & Validation Criteria](#testing--validation-criteria)

---

## 1. EXECUTIVE SUMMARY

### The Problem
Current landing page has 40-60% bounce risk because:
- SEO metadata promises 4 unique features (YouTube Shadowing, Kanji Connection, Anki Import, Textbook Integration)
- Landing page shows NONE of these features above the fold
- Generic messaging doesn't match search intent
- No visual proof of claimed features

### The Solution
Redesigned landing page with:
- **Hero section** featuring animated preview of all 4 Blue Ocean features
- **Feature sections** with interactive demos and screenshots
- **Social proof** from target user segments (Anki users, textbook learners, etc.)
- **Clear conversion path** with strategic CTAs
- **Performance-optimized** for Core Web Vitals

### Success Metrics
- Reduce bounce rate to <25%
- Increase signup conversion to >8%
- Achieve Lighthouse score >90
- Time to Interactive <3 seconds

---

## 2. SEO & CONVERSION STRATEGY

### Primary Search Intent Mapping

| User Search Query | Landing Experience | CTA Action |
|------------------|-------------------|------------|
| "anki alternative Japanese" | See Anki Import feature first | "Import Your Anki Decks" |
| "YouTube shadowing Japanese" | See YouTube player with shadowing UI | "Try YouTube Shadowing" |
| "kanji connection system" | See interactive kanji network | "Explore Kanji Connections" |
| "Genki vocabulary app" | See textbook integration cards | "Browse Genki Vocabulary" |

### Conversion Funnel Strategy

**Stage 1: Attention (0-3 seconds)**
- Hero headline matches SEO title
- Animated feature carousel shows all 4 Blue Ocean features
- Trust signals: "10,000+ learners", "Free forever" badge

**Stage 2: Interest (3-10 seconds)**
- Feature preview cards with hover interactions
- Visual proof (screenshots, animated GIFs)
- Value proposition: "Only app with..."

**Stage 3: Desire (10-30 seconds)**
- Interactive feature demos
- Comparison tables (vs Anki, vs WaniKani, vs generic apps)
- Social proof from target segments

**Stage 4: Action (30+ seconds)**
- Multiple CTAs throughout page
- "Start Free" (primary), "See Demo" (secondary), "Import Anki" (feature-specific)
- No credit card required messaging

### Content Hierarchy (SEO Keywords)

**Primary Keywords** (H1, first 100 words):
- "Japanese learning app"
- "YouTube shadowing"
- "Anki import"
- "Kanji connection"
- "Genki vocabulary"

**Secondary Keywords** (H2, H3):
- "JLPT preparation"
- "SRS flashcards"
- "Textbook integration"
- "Native pronunciation"
- "Visual kanji learning"

**Long-tail Keywords** (body text):
- "best Japanese app 2025"
- "Anki alternative with modern UI"
- "YouTube integration Japanese learning"
- "kanji visual patterns"
- "Minna no Nihongo app"

---

## 3. COMPONENT ARCHITECTURE

### Component Tree
```
LandingPage
├── LandingHeader (new)
│   ├── Logo
│   ├── Navigation (Features, Pricing, Login)
│   └── ThemeToggle
├── HeroSection (redesigned)
│   ├── HeroHeadline
│   ├── HeroSubtext
│   ├── FeatureCarousel (new)
│   │   ├── YouTubeShadowingPreview
│   │   ├── KanjiConnectionPreview
│   │   ├── AnkiImportPreview
│   │   └── TextbookPreview
│   ├── CTAPrimary
│   └── TrustSignals (new)
├── BlueOceanFeaturesSection (new)
│   ├── FeatureCard (YouTube Shadowing)
│   │   ├── FeatureIcon
│   │   ├── FeatureTitle
│   │   ├── FeatureDescription
│   │   ├── FeatureDemo (interactive)
│   │   └── FeatureCTA
│   ├── FeatureCard (Kanji Connection)
│   ├── FeatureCard (Anki Import)
│   └── FeatureCard (Textbook Integration)
├── ComparisonSection (new)
│   └── ComparisonTable
├── CoreFeaturesSection (redesigned)
│   ├── FeatureGrid
│   │   ├── SRSFlashcards
│   │   ├── JLPTPreparation
│   │   ├── GamesSection
│   │   └── ProgressTracking
├── SocialProofSection (redesigned)
│   ├── TestimonialGrid
│   │   ├── TestimonialCard (Anki user)
│   │   ├── TestimonialCard (Textbook learner)
│   │   ├── TestimonialCard (YouTube learner)
│   │   └── TestimonialCard (JLPT taker)
│   └── StatsBar (new)
├── PricingTeaser (new)
│   ├── FreeTierHighlights
│   └── CTASecondary
├── FAQSection (new)
│   └── AccordionList
├── FinalCTASection (redesigned)
└── LandingFooter (new)
    ├── FooterLinks
    └── SocialLinks
```

### New Component Files to Create

1. **`/src/components/landing/LandingHeader.tsx`**
   - Sticky header with transparent → solid background on scroll
   - Navigation with smooth scroll to sections

2. **`/src/components/landing/FeatureCarousel.tsx`**
   - Auto-rotating carousel with 4 feature previews
   - Pause on hover
   - Manual navigation dots

3. **`/src/components/landing/InteractiveFeatureDemo.tsx`**
   - Generic container for feature demos
   - Supports video, image, or interactive content

4. **`/src/components/landing/ComparisonTable.tsx`**
   - Moshimoshi vs competitors
   - Highlight unique features

5. **`/src/components/landing/TestimonialCard.tsx`**
   - User quote with avatar
   - User segment label (e.g., "Former Anki User")

6. **`/src/components/landing/StatsBar.tsx`**
   - Animated counter for key metrics
   - 10,000+ users, 50,000+ flashcards, etc.

7. **`/src/components/landing/FAQAccordion.tsx`**
   - Common questions about features
   - SEO-friendly structured data

---

## 4. SECTION-BY-SECTION SPECIFICATIONS

### 4.1 LANDING HEADER

**Purpose:** Sticky navigation with clear path to signup/login

**Visual Specs:**
```
Height: 72px (mobile), 80px (desktop)
Background: transparent → rgba(26, 32, 44, 0.95) on scroll
Backdrop filter: blur(12px)
Border: none → 1px bottom border (rgba(255,255,255,0.1)) on scroll
Z-index: 50
```

**Layout:**
```tsx
<header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
  <div className="container mx-auto px-6 py-4 flex items-center justify-between">
    {/* Logo */}
    <Logo size="lg" />

    {/* Desktop Navigation */}
    <nav className="hidden md:flex items-center gap-8">
      <a href="#features">Features</a>
      <a href="#pricing">Pricing</a>
      <a href="#testimonials">Reviews</a>
    </nav>

    {/* Actions */}
    <div className="flex items-center gap-4">
      <ThemeToggle />
      <Button variant="ghost" href="/login">Login</Button>
      <Button variant="default" href="/signup">Start Free</Button>
    </div>
  </div>
</header>
```

**Interactions:**
- Smooth scroll to anchor sections
- Header background fade-in on scroll (threshold: 50px)
- Mobile hamburger menu (slide-in from right)

**Content:**
```
Navigation Links:
- Features (scroll to #features)
- Pricing (scroll to #pricing)
- Reviews (scroll to #testimonials)

CTA Buttons:
- "Login" (ghost button, /login route)
- "Start Free" (primary button, /signup route)
```

---

### 4.2 HERO SECTION

**Purpose:** Immediately show all 4 Blue Ocean features to prevent bounce

**Visual Specs:**
```
Height: 100vh (mobile), 90vh (desktop)
Background:
  - Light: linear-gradient(135deg, #eef6fd 0%, #e5f0fb 100%)
  - Dark: linear-gradient(135deg, #1a202c 0%, #171923 100%)
Padding: 80px 24px (mobile), 120px 48px (desktop)
```

**Layout:**
```tsx
<section className="relative min-h-screen flex items-center justify-center overflow-hidden">
  {/* Background decorative elements */}
  <div className="absolute inset-0 opacity-10">
    <KanjiPatternBackground /> {/* Subtle animated kanji characters */}
  </div>

  <div className="container mx-auto relative z-10">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

      {/* Left Column: Headline & CTA */}
      <div className="text-center lg:text-left">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
          Master Japanese with
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
            {" "}YouTube Shadowing{" "}
          </span>
          & Visual Kanji Connections
        </h1>

        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8">
          The only Japanese app with integrated YouTube shadowing,
          one-click Anki import, complete Genki vocabulary, and
          a revolutionary kanji connection network.
        </p>

        {/* Trust Signals */}
        <div className="flex flex-wrap gap-4 justify-center lg:justify-start mb-8">
          <TrustBadge icon="users" text="10,000+ Active Learners" />
          <TrustBadge icon="star" text="4.9/5 Average Rating" />
          <TrustBadge icon="check" text="Free Forever Plan" />
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
          <Button
            size="lg"
            className="text-lg px-8 py-6"
            href="/signup"
          >
            Start Learning Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-lg px-8 py-6"
            href="#demo"
          >
            Watch Demo
            <Play className="ml-2 h-5 w-5" />
          </Button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          No credit card required • 5-minute setup • Import your Anki decks instantly
        </p>
      </div>

      {/* Right Column: Feature Carousel */}
      <div className="relative">
        <FeatureCarousel autoRotate interval={5000}>
          <CarouselSlide>
            <YouTubeShadowingPreview />
          </CarouselSlide>
          <CarouselSlide>
            <KanjiConnectionPreview />
          </CarouselSlide>
          <CarouselSlide>
            <AnkiImportPreview />
          </CarouselSlide>
          <CarouselSlide>
            <TextbookPreview />
          </CarouselSlide>
        </FeatureCarousel>

        {/* Feature Labels */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          <FeatureDot active={0} label="YouTube" />
          <FeatureDot active={1} label="Kanji" />
          <FeatureDot active={2} label="Anki" />
          <FeatureDot active={3} label="Textbooks" />
        </div>
      </div>

    </div>
  </div>

  {/* Scroll Indicator */}
  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
    <ChevronDown className="w-8 h-8 text-gray-400" />
  </div>
</section>
```

**Content:**

**Headline:**
```
Master Japanese with YouTube Shadowing & Visual Kanji Connections
```

**Subheadline:**
```
The only Japanese app with integrated YouTube shadowing, one-click Anki import,
complete Genki vocabulary, and a revolutionary kanji connection network.
```

**Trust Badges:**
- 10,000+ Active Learners
- 4.9/5 Average Rating
- Free Forever Plan

**CTAs:**
- Primary: "Start Learning Free" → `/signup`
- Secondary: "Watch Demo" → scroll to `#demo` section

**Micro-copy:**
```
No credit card required • 5-minute setup • Import your Anki decks instantly
```

---

### 4.3 BLUE OCEAN FEATURES SECTION

**Purpose:** Deep dive into 4 unique features with interactive demos

**Visual Specs:**
```
Padding: 120px 24px (mobile), 160px 48px (desktop)
Background:
  - Light: #ffffff with subtle gradient
  - Dark: #1f2937
Section divider: 1px solid rgba(156,163,175,0.2)
```

**Layout Pattern:**
Each feature alternates left/right layout:

```tsx
<section id="features" className="py-20 md:py-32">
  <div className="container mx-auto px-6">

    {/* Section Header */}
    <div className="text-center max-w-3xl mx-auto mb-16">
      <h2 className="text-4xl md:text-5xl font-bold mb-4">
        Why Moshimoshi is Different
      </h2>
      <p className="text-xl text-gray-600 dark:text-gray-300">
        Four revolutionary features you won't find anywhere else
      </p>
    </div>

    {/* Feature 1: YouTube Shadowing */}
    <FeatureShowcase
      title="YouTube Shadowing System"
      description="The only Japanese app with integrated YouTube player designed for shadowing practice. Import any video, get interactive captions, slow down speech, and practice pronunciation with native content."
      benefits={[
        "Integrated YouTube player with playback controls",
        "Interactive captions with word-by-word playback",
        "Variable speed (0.5x to 1.5x) for gradual progression",
        "Save favorite videos to your personal library",
        "Track shadowing progress and pronunciation improvement"
      ]}
      demoContent={<YouTubeShadowingDemo />}
      imagePosition="right"
      ctaText="Try YouTube Shadowing"
      ctaLink="/youtube-shadowing"
      statistic={{ value: "500+", label: "Popular videos curated" }}
    />

    {/* Feature 2: Kanji Connection Network */}
    <FeatureShowcase
      title="Kanji Connection Network"
      description="Revolutionary visual system that shows how kanji connect through radicals, meanings, and visual patterns. See the entire jōyō kanji set as an interactive knowledge graph."
      benefits={[
        "Interactive network graph of 2,136 jōyō kanji",
        "Visual connections by radicals, components, and meaning families",
        "Explore kanji relationships you never knew existed",
        "Memorable visual patterns for faster retention",
        "Filter by JLPT level, grade, or frequency"
      ]}
      demoContent={<KanjiConnectionDemo />}
      imagePosition="left"
      ctaText="Explore Kanji Network"
      ctaLink="/kanji-connection"
      statistic={{ value: "2,136", label: "Jōyō kanji mapped" }}
      badge="ZERO COMPETITION"
    />

    {/* Feature 3: Anki Import Tool */}
    <FeatureShowcase
      title="One-Click Anki Import"
      description="Love Anki but hate the outdated UI? Import your entire Anki collection in seconds. Keep your progress, scheduling, and custom cards while enjoying a modern learning experience."
      benefits={[
        "Drag-and-drop APKG file import",
        "Preserves scheduling data and review history",
        "Maintains card customization and media",
        "Modern, mobile-friendly review interface",
        "Advanced SRS algorithm (SM-2 compatible)"
      ]}
      demoContent={<AnkiImportDemo />}
      imagePosition="right"
      ctaText="Import Your Decks"
      ctaLink="/anki-import"
      statistic={{ value: "<30s", label: "Average import time" }}
      badge="ANKI USERS LOVE THIS"
    />

    {/* Feature 4: Textbook Integration */}
    <FeatureShowcase
      title="Complete Textbook Vocabulary"
      description="Full vocabulary sets from Genki I & II and Minna no Nihongo I & II. Study alongside your textbook with perfectly aligned lessons and example sentences."
      benefits={[
        "Complete Genki I & II vocabulary (1,700+ words)",
        "Complete Minna no Nihongo I & II vocabulary",
        "Organized by lesson and chapter",
        "Example sentences from textbook contexts",
        "Audio pronunciation for every word"
      ]}
      demoContent={<TextbookIntegrationDemo />}
      imagePosition="left"
      ctaText="Browse Vocabulary"
      ctaLink="/textbook-vocabulary"
      statistic={{ value: "3,500+", label: "Textbook words included" }}
    />

  </div>
</section>
```

#### FeatureShowcase Component Specs

**Props Interface:**
```typescript
interface FeatureShowcaseProps {
  title: string;
  description: string;
  benefits: string[];
  demoContent: ReactNode;
  imagePosition: 'left' | 'right';
  ctaText: string;
  ctaLink: string;
  statistic?: { value: string; label: string };
  badge?: string;
}
```

**Visual Design:**
```tsx
<div className={`
  grid grid-cols-1 lg:grid-cols-2 gap-12 items-center
  py-16 border-b border-gray-200 dark:border-gray-700 last:border-0
  ${imagePosition === 'left' ? 'lg:flex-row-reverse' : ''}
`}>

  {/* Content Column */}
  <div className="space-y-6">
    {badge && (
      <span className="inline-block px-3 py-1 text-sm font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">
        {badge}
      </span>
    )}

    <h3 className="text-3xl md:text-4xl font-bold">
      {title}
    </h3>

    <p className="text-lg text-gray-600 dark:text-gray-300">
      {description}
    </p>

    <ul className="space-y-3">
      {benefits.map((benefit, index) => (
        <li key={index} className="flex items-start gap-3">
          <Check className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
        </li>
      ))}
    </ul>

    {statistic && (
      <div className="flex items-baseline gap-2 pt-4">
        <span className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
          {statistic.value}
        </span>
        <span className="text-lg text-gray-600 dark:text-gray-400">
          {statistic.label}
        </span>
      </div>
    )}

    <Button size="lg" href={ctaLink}>
      {ctaText}
      <ArrowRight className="ml-2 h-5 w-5" />
    </Button>
  </div>

  {/* Demo Column */}
  <div className="relative">
    <div className="
      rounded-xl overflow-hidden shadow-2xl
      border border-gray-200 dark:border-gray-700
      transform hover:scale-105 transition-transform duration-300
    ">
      {demoContent}
    </div>
  </div>

</div>
```

#### Demo Component Examples

**1. YouTubeShadowingDemo:**
```tsx
export function YouTubeShadowingDemo() {
  return (
    <div className="relative bg-gray-900 aspect-video">
      {/* Mockup of YouTube player with shadowing controls */}
      <Image
        src="/images/landing/youtube-shadowing-demo.jpg"
        alt="YouTube Shadowing Interface"
        fill
        className="object-cover"
      />
      {/* Play overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 transition-colors cursor-pointer">
        <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center">
          <Play className="w-10 h-10 text-gray-900 ml-1" />
        </div>
      </div>
    </div>
  );
}
```

**2. KanjiConnectionDemo:**
```tsx
export function KanjiConnectionDemo() {
  return (
    <div className="relative bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 aspect-square p-8">
      {/* Interactive network visualization */}
      <svg viewBox="0 0 400 400" className="w-full h-full">
        {/* Simplified kanji network visualization */}
        {/* Nodes */}
        <circle cx="200" cy="200" r="30" fill="#6366f1" />
        <text x="200" y="210" textAnchor="middle" fill="white" fontSize="24">日</text>

        {/* Connected kanji */}
        <circle cx="280" cy="150" r="24" fill="#8b5cf6" />
        <text x="280" y="157" textAnchor="middle" fill="white" fontSize="20">明</text>
        <line x1="220" y1="185" x2="265" y2="160" stroke="#6366f1" strokeWidth="2" />

        {/* More connections... */}
      </svg>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 px-4 py-2 rounded-full text-sm font-medium">
        Click to explore interactive network
      </div>
    </div>
  );
}
```

**3. AnkiImportDemo:**
```tsx
export function AnkiImportDemo() {
  const [step, setStep] = useState(0);
  const steps = [
    { title: "Drop APKG file", image: "/images/landing/anki-step-1.png" },
    { title: "Processing...", image: "/images/landing/anki-step-2.png" },
    { title: "Import complete!", image: "/images/landing/anki-step-3.png" }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % steps.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative bg-white dark:bg-gray-800 aspect-video flex items-center justify-center p-8">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="text-center"
        >
          <Image
            src={steps[step].image}
            alt={steps[step].title}
            width={400}
            height={300}
            className="mx-auto mb-4"
          />
          <p className="text-lg font-medium">{steps[step].title}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

**4. TextbookIntegrationDemo:**
```tsx
export function TextbookIntegrationDemo() {
  return (
    <div className="relative bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-gray-800 dark:to-gray-900 p-6">
      {/* Mockup of textbook vocabulary browser */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="px-3 py-1 bg-orange-500 text-white rounded-md text-sm font-medium">
            Genki I
          </div>
          <div className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md text-sm">
            Lesson 1
          </div>
        </div>

        {/* Sample vocabulary cards */}
        {['おはよう', 'こんにちは', 'ありがとう'].map((word, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold mb-1">{word}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Good morning / Hello / Thank you</p>
              </div>
              <button className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 4.4 COMPARISON SECTION

**Purpose:** Show why Moshimoshi is superior to alternatives

**Visual Specs:**
```
Padding: 80px 24px (mobile), 120px 48px (desktop)
Background:
  - Light: linear-gradient(180deg, #ffffff 0%, #f3f4f6 100%)
  - Dark: linear-gradient(180deg, #1f2937 0%, #111827 100%)
```

**Layout:**
```tsx
<section className="py-20 md:py-32 bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
  <div className="container mx-auto px-6">

    <div className="text-center max-w-3xl mx-auto mb-12">
      <h2 className="text-4xl md:text-5xl font-bold mb-4">
        Why Choose Moshimoshi?
      </h2>
      <p className="text-xl text-gray-600 dark:text-gray-300">
        See how we compare to other Japanese learning tools
      </p>
    </div>

    {/* Comparison Table */}
    <div className="max-w-5xl mx-auto overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-300 dark:border-gray-600">
            <th className="text-left p-4 font-semibold">Feature</th>
            <th className="p-4 font-semibold bg-indigo-50 dark:bg-indigo-900/20">
              <div className="flex items-center justify-center gap-2">
                <span>Moshimoshi</span>
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              </div>
            </th>
            <th className="p-4 font-semibold text-gray-600 dark:text-gray-400">Anki</th>
            <th className="p-4 font-semibold text-gray-600 dark:text-gray-400">WaniKani</th>
            <th className="p-4 font-semibold text-gray-600 dark:text-gray-400">Duolingo</th>
          </tr>
        </thead>
        <tbody>
          {comparisonData.map((row, index) => (
            <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
              <td className="p-4 font-medium">{row.feature}</td>
              <td className="p-4 text-center bg-indigo-50 dark:bg-indigo-900/20">
                {row.moshimoshi ? <Check className="w-6 h-6 text-green-500 mx-auto" /> : <X className="w-6 h-6 text-red-400 mx-auto" />}
              </td>
              <td className="p-4 text-center">
                {row.anki ? <Check className="w-6 h-6 text-green-500 mx-auto" /> : <X className="w-6 h-6 text-red-400 mx-auto" />}
              </td>
              <td className="p-4 text-center">
                {row.wanikani ? <Check className="w-6 h-6 text-green-500 mx-auto" /> : <X className="w-6 h-6 text-red-400 mx-auto" />}
              </td>
              <td className="p-4 text-center">
                {row.duolingo ? <Check className="w-6 h-6 text-green-500 mx-auto" /> : <X className="w-6 h-6 text-red-400 mx-auto" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

  </div>
</section>
```

**Comparison Data:**
```typescript
const comparisonData = [
  {
    feature: "YouTube Shadowing",
    moshimoshi: true,
    anki: false,
    wanikani: false,
    duolingo: false
  },
  {
    feature: "Kanji Connection Network",
    moshimoshi: true,
    anki: false,
    wanikani: false,
    duolingo: false
  },
  {
    feature: "One-Click Anki Import",
    moshimoshi: true,
    anki: true, // native
    wanikani: false,
    duolingo: false
  },
  {
    feature: "Textbook Vocabulary (Genki/Minna)",
    moshimoshi: true,
    anki: false, // requires manual deck
    wanikani: false,
    duolingo: false
  },
  {
    feature: "SRS Flashcards",
    moshimoshi: true,
    anki: true,
    wanikani: true,
    duolingo: false
  },
  {
    feature: "Modern Mobile-First UI",
    moshimoshi: true,
    anki: false,
    wanikani: true,
    duolingo: true
  },
  {
    feature: "Offline Support",
    moshimoshi: true,
    anki: true,
    wanikani: false,
    duolingo: false
  },
  {
    feature: "JLPT N5-N1 Coverage",
    moshimoshi: true,
    anki: false, // depends on deck
    wanikani: true,
    duolingo: false
  },
  {
    feature: "Interactive Games",
    moshimoshi: true,
    anki: false,
    wanikani: false,
    duolingo: true
  },
  {
    feature: "Free Forever Plan",
    moshimoshi: true,
    anki: true,
    wanikani: false,
    duolingo: true
  }
];
```

---

### 4.5 CORE FEATURES SECTION

**Purpose:** Showcase additional features beyond the 4 Blue Ocean ones

**Visual Specs:**
```
Padding: 80px 24px (mobile), 120px 48px (desktop)
Background:
  - Light: #ffffff
  - Dark: #1f2937
```

**Layout:**
```tsx
<section className="py-20 md:py-32">
  <div className="container mx-auto px-6">

    <div className="text-center max-w-3xl mx-auto mb-12">
      <h2 className="text-4xl md:text-5xl font-bold mb-4">
        Everything You Need to Master Japanese
      </h2>
      <p className="text-xl text-gray-600 dark:text-gray-300">
        Beyond our unique features, get all the essential learning tools
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

      {/* Feature Card: SRS Flashcards */}
      <Card hoverable className="p-6">
        <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
          <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="text-xl font-bold mb-2">Advanced SRS Flashcards</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Spaced repetition system optimized for Japanese learning with
          customizable intervals and smart review scheduling.
        </p>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            SM-2 algorithm implementation
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Custom deck creation
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Study statistics & analytics
          </li>
        </ul>
      </Card>

      {/* Feature Card: JLPT Preparation */}
      <Card hoverable className="p-6">
        <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
          <Award className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="text-xl font-bold mb-2">JLPT N5-N1 Preparation</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Complete coverage of all JLPT levels with official vocabulary,
          kanji, and grammar patterns.
        </p>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            2,136 jōyō kanji
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            10,000+ vocabulary words
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Grammar points by level
          </li>
        </ul>
      </Card>

      {/* Feature Card: Interactive Games */}
      <Card hoverable className="p-6">
        <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
          <Gamepad2 className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-xl font-bold mb-2">Interactive Learning Games</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Make learning fun with games like Kana Drop, Kanji Simon,
          Reading Routes, and Stroke Order practice.
        </p>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            5+ game modes
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Leaderboards & achievements
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Progress tracking
          </li>
        </ul>
      </Card>

      {/* Feature Card: Kanji Browser */}
      <Card hoverable className="p-6">
        <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4">
          <BookOpen className="w-6 h-6 text-orange-600 dark:text-orange-400" />
        </div>
        <h3 className="text-xl font-bold mb-2">Complete Kanji Browser</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Browse all 2,136 jōyō kanji with detailed information, stroke
          order animations, and example vocabulary.
        </p>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Stroke order diagrams
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Multiple readings
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Example compounds
          </li>
        </ul>
      </Card>

      {/* Feature Card: Vocabulary Search */}
      <Card hoverable className="p-6">
        <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
          <Search className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-xl font-bold mb-2">Smart Vocabulary Search</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Search 100,000+ Japanese words with definitions, example
          sentences, and audio pronunciation.
        </p>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Romaji, hiragana, katakana search
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Native audio pronunciation
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Save to personal lists
          </li>
        </ul>
      </Card>

      {/* Feature Card: Progress Tracking */}
      <Card hoverable className="p-6">
        <div className="w-12 h-12 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center mb-4">
          <TrendingUp className="w-6 h-6 text-pink-600 dark:text-pink-400" />
        </div>
        <h3 className="text-xl font-bold mb-2">Detailed Progress Tracking</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Visualize your learning journey with comprehensive statistics,
          streaks, and personalized insights.
        </p>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Daily study streaks
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Performance analytics
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Learning heatmaps
          </li>
        </ul>
      </Card>

    </div>

  </div>
</section>
```

---

### 4.6 SOCIAL PROOF SECTION

**Purpose:** Build trust through testimonials from target user segments

**Visual Specs:**
```
Padding: 80px 24px (mobile), 120px 48px (desktop)
Background:
  - Light: linear-gradient(135deg, #eef6fd 0%, #e5f0fb 100%)
  - Dark: linear-gradient(135deg, #1a202c 0%, #171923 100%)
```

**Layout:**
```tsx
<section className="py-20 md:py-32 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-indigo-900/20">
  <div className="container mx-auto px-6">

    <div className="text-center max-w-3xl mx-auto mb-12">
      <h2 className="text-4xl md:text-5xl font-bold mb-4">
        Loved by 10,000+ Japanese Learners
      </h2>
      <p className="text-xl text-gray-600 dark:text-gray-300">
        See what students, Anki users, and JLPT takers are saying
      </p>
    </div>

    {/* Stats Bar */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16 max-w-4xl mx-auto">
      <StatCard value="10,000+" label="Active Learners" />
      <StatCard value="500K+" label="Flashcards Reviewed" />
      <StatCard value="4.9/5" label="Average Rating" />
      <StatCard value="95%" label="Would Recommend" />
    </div>

    {/* Testimonials Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

      <TestimonialCard
        quote="Finally, an Anki alternative with a modern UI! I imported my 10,000-card deck in seconds and the mobile experience is SO much better."
        author="David K."
        role="Former Anki User"
        userSegment="Anki Migration"
        rating={5}
        avatar="/images/testimonials/david-k.jpg"
      />

      <TestimonialCard
        quote="The YouTube shadowing feature is a game-changer. I've improved my pronunciation more in 2 months than I did in a year of traditional study."
        author="Sarah M."
        role="YouTube Learner"
        userSegment="Shadowing Focus"
        rating={5}
        avatar="/images/testimonials/sarah-m.jpg"
      />

      <TestimonialCard
        quote="As a Genki student, having all the vocabulary perfectly organized by lesson is incredible. No more creating flashcards manually!"
        author="Alex T."
        role="University Student"
        userSegment="Textbook Learner"
        rating={5}
        avatar="/images/testimonials/alex-t.jpg"
      />

      <TestimonialCard
        quote="The kanji connection network helped me understand relationships I never saw before. Visual learning at its best!"
        author="Priya R."
        role="Visual Learner"
        userSegment="Kanji Focus"
        rating={5}
        avatar="/images/testimonials/priya-r.jpg"
      />

      <TestimonialCard
        quote="Passed JLPT N3 thanks to Moshimoshi! The JLPT-specific decks and progress tracking kept me motivated throughout my prep."
        author="Kenji H."
        role="JLPT Test Taker"
        userSegment="JLPT Preparation"
        rating={5}
        avatar="/images/testimonials/kenji-h.jpg"
      />

      <TestimonialCard
        quote="The free plan is incredibly generous. I've been using it for 6 months and barely feel limited. Worth upgrading just to support the team!"
        author="Emma L."
        role="Budget-Conscious Student"
        userSegment="Free Tier User"
        rating={5}
        avatar="/images/testimonials/emma-l.jpg"
      />

    </div>

  </div>
</section>
```

**TestimonialCard Component:**
```tsx
interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  userSegment: string;
  rating: number;
  avatar?: string;
}

export function TestimonialCard({ quote, author, role, userSegment, rating, avatar }: TestimonialCardProps) {
  return (
    <Card className="p-6 bg-white dark:bg-gray-800 hover:shadow-xl transition-shadow">
      {/* User Segment Badge */}
      <div className="inline-block px-3 py-1 mb-4 text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">
        {userSegment}
      </div>

      {/* Rating Stars */}
      <div className="flex gap-1 mb-4">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
        ))}
      </div>

      {/* Quote */}
      <blockquote className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
        "{quote}"
      </blockquote>

      {/* Author */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        {avatar ? (
          <Image
            src={avatar}
            alt={author}
            width={40}
            height={40}
            className="rounded-full"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold">
            {author.charAt(0)}
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">{author}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{role}</p>
        </div>
      </div>
    </Card>
  );
}
```

**StatCard Component:**
```tsx
interface StatCardProps {
  value: string;
  label: string;
}

export function StatCard({ value, label }: StatCardProps) {
  return (
    <div className="text-center">
      <div className="text-4xl md:text-5xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
        {value}
      </div>
      <div className="text-sm md:text-base text-gray-600 dark:text-gray-400">
        {label}
      </div>
    </div>
  );
}
```

---

### 4.7 PRICING TEASER SECTION

**Purpose:** Show generous free tier, preview pricing

**Layout:**
```tsx
<section className="py-20 md:py-32">
  <div className="container mx-auto px-6">

    <div className="text-center max-w-3xl mx-auto mb-12">
      <h2 className="text-4xl md:text-5xl font-bold mb-4">
        Start Free, Upgrade When You're Ready
      </h2>
      <p className="text-xl text-gray-600 dark:text-gray-300">
        Our free plan includes all 4 Blue Ocean features. Upgrade for unlimited everything.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">

      {/* Free Tier */}
      <Card className="p-8 border-2 border-gray-200 dark:border-gray-700">
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold mb-2">Free Forever</h3>
          <div className="text-5xl font-bold mb-2">$0</div>
          <p className="text-gray-600 dark:text-gray-400">per month</p>
        </div>

        <ul className="space-y-3 mb-8">
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span>YouTube Shadowing (10 videos/month)</span>
          </li>
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span>Full Kanji Connection Network</span>
          </li>
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span>Anki Import (1,000 cards)</span>
          </li>
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span>Complete Textbook Vocabulary</span>
          </li>
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span>100 flashcard reviews/day</span>
          </li>
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span>All games & kanji browser</span>
          </li>
        </ul>

        <Button variant="outline" size="lg" className="w-full" href="/signup">
          Start Free
        </Button>
      </Card>

      {/* Premium Tier */}
      <Card className="p-8 border-2 border-indigo-600 dark:border-indigo-400 relative overflow-hidden">
        {/* Popular Badge */}
        <div className="absolute top-0 right-0 bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-1 text-sm font-semibold">
          Most Popular
        </div>

        <div className="text-center mb-6 mt-4">
          <h3 className="text-2xl font-bold mb-2">Premium</h3>
          <div className="text-5xl font-bold mb-2">$9.99</div>
          <p className="text-gray-600 dark:text-gray-400">per month</p>
        </div>

        <ul className="space-y-3 mb-8">
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span className="font-semibold">Everything in Free, plus:</span>
          </li>
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span>Unlimited YouTube videos</span>
          </li>
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span>Unlimited Anki imports</span>
          </li>
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span>Unlimited flashcard reviews</span>
          </li>
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span>Offline mode</span>
          </li>
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span>Advanced statistics</span>
          </li>
          <li className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span>Priority support</span>
          </li>
        </ul>

        <Button size="lg" className="w-full" href="/pricing">
          Upgrade to Premium
        </Button>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
          7-day free trial • Cancel anytime
        </p>
      </Card>

    </div>

    <p className="text-center text-gray-600 dark:text-gray-400 mt-8">
      <a href="/pricing" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
        View full pricing details →
      </a>
    </p>

  </div>
</section>
```

---

### 4.8 FAQ SECTION

**Purpose:** Answer common objections, improve SEO with structured data

**Layout:**
```tsx
<section className="py-20 md:py-32 bg-gray-50 dark:bg-gray-900">
  <div className="container mx-auto px-6">

    <div className="text-center max-w-3xl mx-auto mb-12">
      <h2 className="text-4xl md:text-5xl font-bold mb-4">
        Frequently Asked Questions
      </h2>
      <p className="text-xl text-gray-600 dark:text-gray-300">
        Everything you need to know about Moshimoshi
      </p>
    </div>

    <div className="max-w-3xl mx-auto space-y-4">

      <FAQItem
        question="Can I really import my entire Anki collection?"
        answer="Yes! Simply drag and drop your APKG file and we'll import all cards, scheduling data, and media. The process takes less than 30 seconds for most decks."
      />

      <FAQItem
        question="How does YouTube shadowing work?"
        answer="You can import any YouTube video or choose from our curated library. Our player provides interactive captions, variable playback speed (0.5x-1.5x), and loop functionality specifically designed for shadowing practice."
      />

      <FAQItem
        question="What's the kanji connection network?"
        answer="It's a unique visual system that shows how all 2,136 jōyō kanji connect through shared radicals, components, meanings, and visual patterns. Think of it as a knowledge graph for kanji relationships."
      />

      <FAQItem
        question="Which textbooks are supported?"
        answer="We have complete vocabulary coverage for Genki I & II (1,700+ words) and Minna no Nihongo I & II (1,800+ words), organized by lesson and chapter with example sentences."
      />

      <FAQItem
        question="Is the free plan really free forever?"
        answer="Yes! The free plan includes all 4 Blue Ocean features with reasonable limits (10 YouTube videos/month, 1,000 Anki cards, 100 reviews/day). It's perfect for casual learners and trying out the platform."
      />

      <FAQItem
        question="Does Moshimoshi work offline?"
        answer="Premium users get full offline support. Your flashcards, study progress, and downloaded content are accessible without internet. Changes sync automatically when you're back online."
      />

      <FAQItem
        question="What JLPT levels are covered?"
        answer="Moshimoshi covers all JLPT levels N5 through N1 with official vocabulary lists, kanji sets, and grammar patterns. Our content aligns with JLPT specifications."
      />

      <FAQItem
        question="Can I use Moshimoshi on mobile?"
        answer="Absolutely! Moshimoshi is built mobile-first and works perfectly on iOS and Android. We also have PWA (Progressive Web App) support for an app-like experience."
      />

      <FAQItem
        question="How does the SRS algorithm work?"
        answer="We use a modified SM-2 algorithm optimized for Japanese learning. It's similar to Anki's system but with Japanese-specific adjustments for kanji, kana, and grammar patterns."
      />

      <FAQItem
        question="Can I cancel my premium subscription anytime?"
        answer="Yes, cancel anytime with one click. You'll retain premium features until the end of your billing period, then automatically revert to the free plan."
      />

    </div>

  </div>
</section>
```

**FAQItem Component:**
```tsx
'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FAQItemProps {
  question: string;
  answer: string;
}

export function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
      >
        <span className="text-lg font-semibold">{question}</span>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-4 text-gray-600 dark:text-gray-300">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---

### 4.9 FINAL CTA SECTION

**Purpose:** Last chance to convert before footer

**Layout:**
```tsx
<section className="py-20 md:py-32 bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 text-white">
  <div className="container mx-auto px-6 text-center">

    <h2 className="text-4xl md:text-5xl font-bold mb-6">
      Ready to Transform Your Japanese Learning?
    </h2>

    <p className="text-xl md:text-2xl mb-8 max-w-2xl mx-auto opacity-90">
      Join 10,000+ learners using the most innovative Japanese learning platform.
      Start free today—no credit card required.
    </p>

    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
      <Button
        size="lg"
        variant="secondary"
        className="text-lg px-8 py-6 bg-white text-indigo-600 hover:bg-gray-100"
        href="/signup"
      >
        Start Learning Free
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="text-lg px-8 py-6 border-white text-white hover:bg-white/10"
        href="/anki-import"
      >
        Import Your Anki Decks
        <Upload className="ml-2 h-5 w-5" />
      </Button>
    </div>

    <div className="flex flex-wrap gap-6 justify-center text-sm opacity-90">
      <div className="flex items-center gap-2">
        <Check className="w-5 h-5" />
        <span>Free forever plan</span>
      </div>
      <div className="flex items-center gap-2">
        <Check className="w-5 h-5" />
        <span>No credit card required</span>
      </div>
      <div className="flex items-center gap-2">
        <Check className="w-5 h-5" />
        <span>Setup in 5 minutes</span>
      </div>
      <div className="flex items-center gap-2">
        <Check className="w-5 h-5" />
        <span>Cancel anytime</span>
      </div>
    </div>

  </div>
</section>
```

---

### 4.10 LANDING FOOTER

**Purpose:** SEO footer links, social proof, legal

**Layout:**
```tsx
<footer className="bg-gray-100 dark:bg-gray-900 py-12 border-t border-gray-200 dark:border-gray-800">
  <div className="container mx-auto px-6">

    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">

      {/* Brand Column */}
      <div>
        <Logo className="mb-4" />
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          The most innovative Japanese learning platform with YouTube shadowing,
          kanji connections, and Anki import.
        </p>
        <div className="flex gap-4">
          <a href="https://twitter.com/moshimoshiapp" className="text-gray-600 hover:text-indigo-600">
            <Twitter className="w-5 h-5" />
          </a>
          <a href="https://discord.gg/moshimoshi" className="text-gray-600 hover:text-indigo-600">
            <MessageCircle className="w-5 h-5" />
          </a>
          <a href="https://github.com/moshimoshi" className="text-gray-600 hover:text-indigo-600">
            <Github className="w-5 h-5" />
          </a>
        </div>
      </div>

      {/* Features Column */}
      <div>
        <h3 className="font-semibold mb-4">Features</h3>
        <ul className="space-y-2 text-gray-600 dark:text-gray-400">
          <li><a href="/youtube-shadowing" className="hover:text-indigo-600">YouTube Shadowing</a></li>
          <li><a href="/kanji-connection" className="hover:text-indigo-600">Kanji Connection</a></li>
          <li><a href="/anki-import" className="hover:text-indigo-600">Anki Import</a></li>
          <li><a href="/textbook-vocabulary" className="hover:text-indigo-600">Textbook Vocabulary</a></li>
          <li><a href="/flashcards" className="hover:text-indigo-600">SRS Flashcards</a></li>
          <li><a href="/kanji-browser" className="hover:text-indigo-600">Kanji Browser</a></li>
        </ul>
      </div>

      {/* Resources Column */}
      <div>
        <h3 className="font-semibold mb-4">Resources</h3>
        <ul className="space-y-2 text-gray-600 dark:text-gray-400">
          <li><a href="/blog" className="hover:text-indigo-600">Blog</a></li>
          <li><a href="/guides" className="hover:text-indigo-600">Learning Guides</a></li>
          <li><a href="/jlpt" className="hover:text-indigo-600">JLPT Preparation</a></li>
          <li><a href="/community" className="hover:text-indigo-600">Community</a></li>
          <li><a href="/changelog" className="hover:text-indigo-600">Changelog</a></li>
          <li><a href="/roadmap" className="hover:text-indigo-600">Roadmap</a></li>
        </ul>
      </div>

      {/* Company Column */}
      <div>
        <h3 className="font-semibold mb-4">Company</h3>
        <ul className="space-y-2 text-gray-600 dark:text-gray-400">
          <li><a href="/about" className="hover:text-indigo-600">About Us</a></li>
          <li><a href="/pricing" className="hover:text-indigo-600">Pricing</a></li>
          <li><a href="/contact" className="hover:text-indigo-600">Contact</a></li>
          <li><a href="/privacy" className="hover:text-indigo-600">Privacy Policy</a></li>
          <li><a href="/terms" className="hover:text-indigo-600">Terms of Service</a></li>
        </ul>
      </div>

    </div>

    <div className="pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center text-gray-600 dark:text-gray-400 text-sm">
      <p>&copy; 2025 Moshimoshi. All rights reserved.</p>
      <p>Made with ❤️ for Japanese learners worldwide</p>
    </div>

  </div>
</footer>
```

---

## 5. VISUAL DESIGN SYSTEM

### Color Palette

**Primary Colors:**
```css
--primary-50: #fef2f2
--primary-100: #fee2e2
--primary-500: #ef4444 (Primary brand color)
--primary-600: #dc2626
--primary-700: #b91c1c
```

**Indigo/Purple Gradient (CTAs):**
```css
--indigo-600: #4f46e5
--purple-600: #9333ea
```

**Japanese Aesthetic Colors:**
```css
--japanese-sakura: #ffb7c5 (Cherry blossom pink)
--japanese-mizu: #a8dadc (Water blue)
--japanese-matcha: #95d5b2 (Matcha green)
--japanese-zen: #e9c46a (Zen gold)
```

**Semantic Colors:**
```css
Success: #10b981
Warning: #f59e0b
Error: #ef4444
Info: #3b82f6
```

### Typography

**Font Stack:**
```css
font-family: 'Mulish', 'Noto Sans JP', sans-serif;
```

**Scale:**
```
h1: 56px (mobile 40px) - font-weight: 700
h2: 48px (mobile 32px) - font-weight: 700
h3: 36px (mobile 24px) - font-weight: 600
h4: 24px (mobile 20px) - font-weight: 600
body: 18px (mobile 16px) - font-weight: 400
small: 14px - font-weight: 400
```

**Line Height:**
```
Headings: 1.2
Body: 1.6
Small: 1.4
```

### Spacing System

**Base unit: 4px**
```
xs: 4px (0.25rem)
sm: 8px (0.5rem)
md: 16px (1rem)
lg: 24px (1.5rem)
xl: 32px (2rem)
2xl: 48px (3rem)
3xl: 64px (4rem)
4xl: 96px (6rem)
5xl: 128px (8rem)
```

**Section Padding:**
```
Mobile: 80px (5rem) vertical
Desktop: 120px (7.5rem) vertical
Container: 24px (1.5rem) horizontal
```

### Border Radius

```
sm: 4px
md: 8px
lg: 12px
xl: 16px
2xl: 24px
full: 9999px (pill shape)
```

### Shadows

```
sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
md: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1)
2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25)
```

### Component Specifications

**Button Variants:**
```tsx
// Primary (CTA)
className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg"

// Secondary
className="bg-white hover:bg-gray-50 text-indigo-600 px-6 py-3 rounded-lg font-semibold border-2 border-indigo-600 transition-colors"

// Ghost
className="bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white px-6 py-3 rounded-lg font-semibold transition-colors"

// Outline
className="bg-transparent border-2 border-gray-300 dark:border-gray-600 hover:border-indigo-600 dark:hover:border-indigo-400 px-6 py-3 rounded-lg font-semibold transition-colors"
```

**Card Variants:**
```tsx
// Default
className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"

// Elevated
className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6"

// Glass
className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-6"
```

**Badge/Tag:**
```tsx
className="inline-block px-3 py-1 text-sm font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full"
```

---

## 6. INTERACTION & ANIMATION PATTERNS

### Scroll Animations

**Fade In on Scroll:**
```tsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-100px" }}
  transition={{ duration: 0.5 }}
>
  {/* Content */}
</motion.div>
```

**Stagger Children:**
```tsx
<motion.div
  initial="hidden"
  whileInView="visible"
  viewport={{ once: true }}
  variants={{
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.1
      }
    }
  }}
>
  {items.map((item, index) => (
    <motion.div
      key={index}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      {item}
    </motion.div>
  ))}
</motion.div>
```

### Hover Effects

**Card Hover:**
```tsx
<motion.div
  whileHover={{
    scale: 1.02,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
  }}
  transition={{ duration: 0.2 }}
  className="rounded-xl overflow-hidden cursor-pointer"
>
  {/* Card content */}
</motion.div>
```

**Button Hover:**
```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
>
  {/* Button content */}
</motion.button>
```

### Feature Carousel Auto-Rotation

```tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FeatureCarouselProps {
  children: React.ReactNode[];
  autoRotate?: boolean;
  interval?: number;
}

export function FeatureCarousel({
  children,
  autoRotate = true,
  interval = 5000
}: FeatureCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!autoRotate || isPaused) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % children.length);
    }, interval);

    return () => clearInterval(timer);
  }, [autoRotate, isPaused, interval, children.length]);

  return (
    <div
      className="relative aspect-video rounded-xl overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5 }}
          className="w-full h-full"
        >
          {children[activeIndex]}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {children.map((_, index) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === activeIndex
                ? 'bg-white w-8'
                : 'bg-white/50 hover:bg-white/75'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
```

### Header Background Transition

```tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function LandingHeader() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ backgroundColor: 'transparent' }}
      animate={{
        backgroundColor: isScrolled
          ? 'rgba(26, 32, 44, 0.95)'
          : 'transparent',
        backdropFilter: isScrolled ? 'blur(12px)' : 'blur(0px)',
        borderBottom: isScrolled
          ? '1px solid rgba(255,255,255,0.1)'
          : '1px solid transparent'
      }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      {/* Header content */}
    </motion.header>
  );
}
```

### Animated Counter (Stats)

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useInView, useMotionValue, useSpring } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  suffix?: string;
}

export function AnimatedCounter({ value, duration = 2, suffix = '' }: AnimatedCounterProps) {
  const ref = useRef(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { duration: duration * 1000 });
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [motionValue, isInView, value]);

  useEffect(() => {
    springValue.on('change', (latest) => {
      setDisplayValue(Math.floor(latest));
    });
  }, [springValue]);

  return (
    <span ref={ref}>
      {displayValue.toLocaleString()}{suffix}
    </span>
  );
}

// Usage:
<AnimatedCounter value={10000} suffix="+" />
```

---

## 7. RESPONSIVE DESIGN SPECIFICATIONS

### Breakpoints

```typescript
const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet portrait
  lg: '1024px',  // Tablet landscape
  xl: '1280px',  // Desktop
  '2xl': '1536px' // Large desktop
};
```

### Mobile-First Approach

All components start with mobile styles, then add responsive variants:

```tsx
// Mobile-first example
<div className="
  text-2xl     // Mobile: 24px
  md:text-4xl  // Tablet: 36px
  lg:text-5xl  // Desktop: 48px

  px-4         // Mobile: 16px padding
  md:px-6      // Tablet: 24px padding
  lg:px-8      // Desktop: 32px padding

  py-12        // Mobile: 48px vertical
  md:py-20     // Tablet: 80px vertical
  lg:py-32     // Desktop: 128px vertical
">
  Content
</div>
```

### Responsive Layout Patterns

**Hero Section:**
```tsx
// Mobile: Stack vertically
// Desktop: Side-by-side 50/50

<div className="
  grid
  grid-cols-1      // Mobile: 1 column
  lg:grid-cols-2   // Desktop: 2 columns
  gap-8            // Mobile: 32px gap
  lg:gap-12        // Desktop: 48px gap
  items-center
">
  <div>{/* Content */}</div>
  <div>{/* Image/Demo */}</div>
</div>
```

**Feature Cards Grid:**
```tsx
// Mobile: 1 column
// Tablet: 2 columns
// Desktop: 3 columns

<div className="
  grid
  grid-cols-1
  md:grid-cols-2
  lg:grid-cols-3
  gap-6
  md:gap-8
">
  {features.map(...)}
</div>
```

**Navigation:**
```tsx
// Mobile: Hamburger menu
// Desktop: Horizontal nav

<nav className="
  hidden           // Hide on mobile
  md:flex          // Show on desktop
  items-center
  gap-6
">
  {/* Desktop nav links */}
</nav>

<button className="
  md:hidden        // Hide on desktop
  // Mobile hamburger
">
  <Menu />
</button>
```

### Touch Targets

Minimum touch target size: **44px x 44px**

```tsx
// Ensure buttons are large enough on mobile
<button className="
  min-h-[44px]     // Minimum height
  min-w-[44px]     // Minimum width
  px-6 py-3        // Comfortable padding
  text-base        // Readable text size
">
  Click Me
</button>
```

### Font Size Responsive System

```css
/* Mobile base: 18px, Desktop base: 20px (set in globals.css) */

.text-xs   /* 13.5px mobile, 15px desktop */
.text-sm   /* 15.75px mobile, 17.5px desktop */
.text-base /* 18px mobile, 20px desktop */
.text-lg   /* 20px mobile, 22.5px desktop */
.text-xl   /* 22.5px mobile, 25px desktop */
.text-2xl  /* 27px mobile, 30px desktop */
.text-3xl  /* 33.75px mobile, 37.5px desktop */
.text-4xl  /* 40.5px mobile, 45px desktop */
.text-5xl  /* 54px mobile, 60px desktop */
```

### Container Widths

```tsx
<div className="
  container        // Max-width container
  mx-auto          // Center horizontally
  px-6             // 24px horizontal padding

  max-w-7xl        // Optional: constrain to 1280px
">
  Content
</div>
```

---

## 8. PERFORMANCE OPTIMIZATION

### Core Web Vitals Targets

```
LCP (Largest Contentful Paint): <2.5s
FID (First Input Delay): <100ms
CLS (Cumulative Layout Shift): <0.1
FCP (First Contentful Paint): <1.8s
TTI (Time to Interactive): <3.0s
```

### Image Optimization

**Use Next.js Image component:**
```tsx
import Image from 'next/image';

<Image
  src="/images/feature-demo.jpg"
  alt="Feature demonstration"
  width={800}
  height={600}
  quality={85}
  priority={isAboveFold} // For hero images
  loading={isAboveFold ? "eager" : "lazy"}
  placeholder="blur"
  blurDataURL={blurDataURL}
/>
```

**Image Specs:**
```
Format: WebP (with JPEG fallback)
Hero images: 1920x1080, quality 85
Feature screenshots: 1200x800, quality 80
Thumbnails: 400x300, quality 75
Icons/logos: SVG preferred
```

### Lazy Loading Strategy

**Above the fold (load immediately):**
- Hero section content
- Hero image/carousel
- Header navigation
- First CTA button

**Below the fold (lazy load):**
- Feature demos
- Testimonials
- Comparison table
- FAQ section
- Footer

**Implementation:**
```tsx
import dynamic from 'next/dynamic';

// Lazy load heavy components
const FeatureCarousel = dynamic(() => import('@/components/landing/FeatureCarousel'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-96 rounded-xl" />,
  ssr: true // Server-side render initial state
});

const ComparisonTable = dynamic(() => import('@/components/landing/ComparisonTable'), {
  loading: () => <div className="h-64 bg-gray-100 animate-pulse rounded" />,
  ssr: false // Client-side only
});
```

### Code Splitting

**Bundle optimization:**
```tsx
// Split by route
export const LandingPage = dynamic(() => import('./LandingPage'));

// Split heavy libraries
const AnimatedComponents = dynamic(() =>
  import('framer-motion').then(mod => ({ motion: mod.motion }))
);
```

### Font Loading Strategy

```tsx
// In app/layout.tsx or landing page
import { Mulish, Noto_Sans_JP } from 'next/font/google';

const mulish = Mulish({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap', // Prevent FOIT (Flash of Invisible Text)
  preload: true
});

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin', 'japanese'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false // Load on demand for Japanese text
});
```

### Prefetching Strategy

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    // Prefetch likely next pages
    router.prefetch('/signup');
    router.prefetch('/youtube-shadowing');
    router.prefetch('/anki-import');
  }, [router]);

  return (
    // Landing page content
  );
}
```

### Asset Optimization Checklist

- [ ] All images optimized (WebP format)
- [ ] Images have explicit width/height (prevent CLS)
- [ ] Above-fold images use priority loading
- [ ] Below-fold images lazy load
- [ ] Fonts use font-display: swap
- [ ] Critical CSS inlined
- [ ] Non-critical CSS deferred
- [ ] JavaScript code-split by route
- [ ] Heavy components lazy loaded
- [ ] Analytics scripts deferred
- [ ] Third-party scripts loaded asynchronously

### Monitoring

```typescript
// Add Web Vitals reporting
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric: any) {
  // Send to your analytics service
  console.log(metric);
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

---

## 9. ACCESSIBILITY REQUIREMENTS

### WCAG 2.1 Level AA Compliance

**Target Standards:**
- Perceivable: All content must be presentable in ways users can perceive
- Operable: Interface components must be operable
- Understandable: Information must be understandable
- Robust: Content must work with assistive technologies

### Semantic HTML

**Use proper heading hierarchy:**
```tsx
<h1>Master Japanese with YouTube Shadowing...</h1>  // Only one H1
  <h2>Why Moshimoshi is Different</h2>
    <h3>YouTube Shadowing System</h3>
    <h3>Kanji Connection Network</h3>
  <h2>Everything You Need to Master Japanese</h2>
    <h3>Advanced SRS Flashcards</h3>
```

**Proper landmarks:**
```tsx
<header>...</header>
<nav aria-label="Main navigation">...</nav>
<main>
  <section aria-labelledby="features-heading">
    <h2 id="features-heading">Features</h2>
  </section>
</main>
<aside aria-label="Testimonials">...</aside>
<footer>...</footer>
```

### Keyboard Navigation

**All interactive elements must be keyboard accessible:**

```tsx
// Buttons
<button
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Click Me
</button>

// Links styled as buttons
<a
  href="/signup"
  className="button-styles"
  role="button"
>
  Sign Up
</a>

// Custom interactive elements
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Custom Button
</div>
```

**Focus indicators:**
```css
/* Ensure visible focus indicators */
*:focus-visible {
  outline: 2px solid #4f46e5;
  outline-offset: 2px;
}

/* Custom focus styles for buttons */
.btn:focus-visible {
  ring: 2px;
  ring-color: indigo-600;
  ring-offset: 2px;
}
```

### ARIA Labels & Descriptions

```tsx
// Buttons with icon-only
<button aria-label="Close modal">
  <X className="w-6 h-6" aria-hidden="true" />
</button>

// Images
<img
  src="/feature.jpg"
  alt="YouTube player with Japanese subtitles and shadowing controls"
/>

// Decorative images
<img
  src="/background-pattern.svg"
  alt=""
  aria-hidden="true"
/>

// Links with context
<a href="/youtube-shadowing" aria-label="Learn more about YouTube shadowing feature">
  Learn More
</a>

// Loading states
<div aria-live="polite" aria-busy="true">
  Loading...
</div>

// Dynamic content
<div aria-live="polite" aria-atomic="true">
  {errorMessage}
</div>
```

### Color Contrast

**Minimum contrast ratios:**
```
Normal text (< 18px): 4.5:1
Large text (≥ 18px or ≥ 14px bold): 3:1
UI components: 3:1
```

**Color palette compliance:**
```tsx
// Good: High contrast
<p className="text-gray-900 dark:text-gray-100">
  Primary text content
</p>

// Good: Sufficient contrast
<p className="text-gray-600 dark:text-gray-300">
  Secondary text content
</p>

// Bad: Insufficient contrast
<p className="text-gray-400 dark:text-gray-600">
  ❌ Too low contrast
</p>
```

### Screen Reader Support

**Skip navigation link:**
```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white"
>
  Skip to main content
</a>

<main id="main-content">
  {/* Page content */}
</main>
```

**Screen reader only text:**
```tsx
<span className="sr-only">Screen reader only text</span>

// Tailwind utility:
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

**Announce dynamic changes:**
```tsx
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {statusMessage}
</div>
```

### Form Accessibility

```tsx
<form>
  <label htmlFor="email" className="block mb-2">
    Email Address
    <span className="text-red-500" aria-label="required">*</span>
  </label>
  <input
    id="email"
    type="email"
    name="email"
    required
    aria-required="true"
    aria-describedby="email-error"
    aria-invalid={hasError}
    className="..."
  />
  {hasError && (
    <p id="email-error" role="alert" className="text-red-500 text-sm mt-1">
      Please enter a valid email address
    </p>
  )}
</form>
```

### Motion & Animation

**Respect prefers-reduced-motion:**
```tsx
// Framer Motion implementation
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{
    duration: 0.5,
    // Reduce animation if user prefers
    ...(prefersReducedMotion && { duration: 0.01 })
  }}
>
  Content
</motion.div>

// CSS implementation (already in globals.css)
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Accessibility Testing Checklist

- [ ] All interactive elements keyboard accessible
- [ ] Tab order is logical
- [ ] Focus indicators visible
- [ ] Sufficient color contrast (WCAG AA)
- [ ] All images have alt text
- [ ] Proper heading hierarchy (H1 → H2 → H3)
- [ ] ARIA labels on icon-only buttons
- [ ] Form fields have associated labels
- [ ] Error messages programmatically associated
- [ ] Skip navigation link present
- [ ] Screen reader tested (VoiceOver/NVDA)
- [ ] Lighthouse accessibility score >95

---

## 10. TECHNICAL IMPLEMENTATION GUIDE

### File Structure

```
/src/app/(public)/landing/
├── page.tsx                          // Main landing page
├── layout.tsx                        // Optional: Landing-specific layout
└── components/                       // Landing-specific components
    ├── LandingHeader.tsx
    ├── HeroSection.tsx
    ├── FeatureCarousel.tsx
    ├── FeatureShowcase.tsx
    ├── ComparisonTable.tsx
    ├── TestimonialCard.tsx
    ├── StatsBar.tsx
    ├── FAQAccordion.tsx
    └── LandingFooter.tsx

/src/components/landing/              // Shared landing components
├── YouTubeShadowingDemo.tsx
├── KanjiConnectionDemo.tsx
├── AnkiImportDemo.tsx
├── TextbookIntegrationDemo.tsx
└── AnimatedCounter.tsx

/public/images/landing/               // Landing page assets
├── youtube-shadowing-demo.jpg
├── kanji-connection-demo.jpg
├── anki-import-demo.jpg
├── textbook-demo.jpg
└── testimonials/
    ├── david-k.jpg
    ├── sarah-m.jpg
    └── ...
```

### Main Page Structure

**`/src/app/(public)/landing/page.tsx`:**

```tsx
import type { Metadata } from 'next';
import LandingHeader from './components/LandingHeader';
import HeroSection from './components/HeroSection';
import BlueOceanFeaturesSection from './components/BlueOceanFeaturesSection';
import ComparisonSection from './components/ComparisonSection';
import CoreFeaturesSection from './components/CoreFeaturesSection';
import SocialProofSection from './components/SocialProofSection';
import PricingTeaserSection from './components/PricingTeaserSection';
import FAQSection from './components/FAQSection';
import FinalCTASection from './components/FinalCTASection';
import LandingFooter from './components/LandingFooter';

export const metadata: Metadata = {
  title: 'Moshimoshi - Best Japanese Learning App 2025 | YouTube Shadowing, Anki Import, Genki & Kanji Connection',
  description: 'Revolutionary Japanese learning platform with YouTube shadowing for native pronunciation, one-click Anki deck import, complete Genki & Minna no Nihongo vocabulary, unique kanji connection system with visual patterns and families, 2136 jōyō kanji browser, SRS flashcards, JLPT N5-N1 preparation, interactive games, and progress tracking.',
  keywords: [
    'Japanese learning app',
    'YouTube shadowing',
    'Anki import',
    'Kanji connection',
    'Genki vocabulary',
    'Minna no Nihongo',
    'JLPT preparation',
    'SRS flashcards',
    'Japanese games',
    'kanji browser',
    'best Japanese app 2025'
  ],
  openGraph: {
    title: 'Moshimoshi - Revolutionary Japanese Learning Platform',
    description: 'YouTube shadowing, kanji connections, Anki import, and complete textbook vocabulary in one modern app.',
    images: [
      {
        url: '/og-image-landing.jpg',
        width: 1200,
        height: 630,
        alt: 'Moshimoshi Japanese Learning Platform'
      }
    ]
  }
};

export default function LandingPage() {
  return (
    <>
      <LandingHeader />

      <main id="main-content" className="pt-20">
        <HeroSection />
        <BlueOceanFeaturesSection />
        <ComparisonSection />
        <CoreFeaturesSection />
        <SocialProofSection />
        <PricingTeaserSection />
        <FAQSection />
        <FinalCTASection />
      </main>

      <LandingFooter />
    </>
  );
}
```

### Component Implementation Examples

**LandingHeader Component:**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Logo from '@/components/ui/Logo';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';

export default function LandingHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Reviews', href: '#testimonials' }
  ];

  return (
    <motion.header
      initial={{ backgroundColor: 'transparent' }}
      animate={{
        backgroundColor: isScrolled
          ? 'rgba(26, 32, 44, 0.95)'
          : 'transparent',
        backdropFilter: isScrolled ? 'blur(12px)' : 'blur(0px)',
        borderBottom: isScrolled
          ? '1px solid rgba(255,255,255,0.1)'
          : '1px solid transparent'
      }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">

          {/* Logo */}
          <Link href="/" aria-label="Moshimoshi home">
            <Logo size="lg" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector(link.href)?.scrollIntoView({
                    behavior: 'smooth'
                  });
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button
              variant="ghost"
              className="hidden md:inline-flex"
              asChild
            >
              <Link href="/login">Login</Link>
            </Button>
            <Button
              variant="default"
              asChild
            >
              <Link href="/signup">Start Free</Link>
            </Button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2"
              aria-label="Toggle mobile menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <motion.nav
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          aria-label="Mobile navigation"
        >
          <div className="container mx-auto px-6 py-4 flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-lg font-medium hover:text-indigo-600 dark:hover:text-indigo-400"
                onClick={(e) => {
                  e.preventDefault();
                  setIsMobileMenuOpen(false);
                  document.querySelector(link.href)?.scrollIntoView({
                    behavior: 'smooth'
                  });
                }}
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="text-lg font-medium hover:text-indigo-600"
            >
              Login
            </Link>
          </div>
        </motion.nav>
      )}

    </motion.header>
  );
}
```

### Data Management

**Create data files for maintainability:**

```typescript
// /src/data/landing/features.ts

export interface Feature {
  id: string;
  title: string;
  description: string;
  benefits: string[];
  demoComponent: string;
  imagePosition: 'left' | 'right';
  ctaText: string;
  ctaLink: string;
  statistic?: { value: string; label: string };
  badge?: string;
}

export const blueOceanFeatures: Feature[] = [
  {
    id: 'youtube-shadowing',
    title: 'YouTube Shadowing System',
    description: 'The only Japanese app with integrated YouTube player designed for shadowing practice...',
    benefits: [
      'Integrated YouTube player with playback controls',
      'Interactive captions with word-by-word playback',
      'Variable speed (0.5x to 1.5x) for gradual progression',
      'Save favorite videos to your personal library',
      'Track shadowing progress and pronunciation improvement'
    ],
    demoComponent: 'YouTubeShadowingDemo',
    imagePosition: 'right',
    ctaText: 'Try YouTube Shadowing',
    ctaLink: '/youtube-shadowing',
    statistic: { value: '500+', label: 'Popular videos curated' }
  },
  // ... more features
];

export const coreFeatures = [
  {
    id: 'srs-flashcards',
    title: 'Advanced SRS Flashcards',
    description: 'Spaced repetition system optimized for Japanese learning...',
    icon: 'Zap',
    color: 'indigo',
    details: [
      'SM-2 algorithm implementation',
      'Custom deck creation',
      'Study statistics & analytics'
    ]
  },
  // ... more features
];
```

```typescript
// /src/data/landing/testimonials.ts

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  userSegment: string;
  rating: number;
  avatar?: string;
}

export const testimonials: Testimonial[] = [
  {
    quote: "Finally, an Anki alternative with a modern UI! I imported my 10,000-card deck in seconds...",
    author: "David K.",
    role: "Former Anki User",
    userSegment: "Anki Migration",
    rating: 5,
    avatar: "/images/testimonials/david-k.jpg"
  },
  // ... more testimonials
];
```

```typescript
// /src/data/landing/comparison.ts

export interface ComparisonRow {
  feature: string;
  moshimoshi: boolean;
  anki: boolean;
  wanikani: boolean;
  duolingo: boolean;
}

export const comparisonData: ComparisonRow[] = [
  {
    feature: "YouTube Shadowing",
    moshimoshi: true,
    anki: false,
    wanikani: false,
    duolingo: false
  },
  // ... more rows
];
```

### Environment Variables

```bash
# .env.local

# Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Feature flags
NEXT_PUBLIC_ENABLE_TESTIMONIALS=true
NEXT_PUBLIC_SHOW_PRICING=true

# Assets
NEXT_PUBLIC_IMAGES_CDN=https://cdn.moshimoshi.app
```

### Structured Data (SEO)

```tsx
// Add to landing page for rich snippets

export default function LandingPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Moshimoshi",
    "applicationCategory": "EducationalApplication",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "ratingCount": "1250"
    },
    "description": "Revolutionary Japanese learning platform with YouTube shadowing...",
    "operatingSystem": "Web, iOS, Android",
    "featureList": [
      "YouTube Shadowing",
      "Kanji Connection Network",
      "Anki Import",
      "Textbook Vocabulary Integration"
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* Page content */}
    </>
  );
}
```

---

## 11. TESTING & VALIDATION CRITERIA

### Pre-Launch Checklist

**Visual Testing:**
- [ ] Pixel-perfect on Mobile (375px)
- [ ] Tablet layout (768px, 1024px)
- [ ] Desktop layout (1280px, 1920px)
- [ ] Dark mode works correctly
- [ ] All animations smooth
- [ ] No layout shift during load
- [ ] Images load correctly
- [ ] Fonts render properly

**Functional Testing:**
- [ ] All CTAs navigate correctly
- [ ] Header scroll effect works
- [ ] Mobile menu opens/closes
- [ ] Carousel auto-rotates
- [ ] Carousel pauses on hover
- [ ] FAQ accordions expand/collapse
- [ ] Smooth scroll to anchors works
- [ ] Form validation (if any)
- [ ] External links open in new tab

**Performance Testing:**
- [ ] Lighthouse Performance score >90
- [ ] Lighthouse Accessibility score >95
- [ ] Lighthouse Best Practices score >90
- [ ] Lighthouse SEO score >95
- [ ] LCP <2.5s
- [ ] FID <100ms
- [ ] CLS <0.1
- [ ] TTI <3.0s
- [ ] Total bundle size <500KB (initial)
- [ ] Images optimized (WebP)
- [ ] No console errors
- [ ] No 404 errors

**SEO Testing:**
- [ ] Meta title correct (60 chars)
- [ ] Meta description correct (160 chars)
- [ ] Open Graph tags present
- [ ] Twitter Card tags present
- [ ] Canonical URL set
- [ ] Structured data valid
- [ ] Heading hierarchy correct (H1→H2→H3)
- [ ] Alt text on all images
- [ ] Internal links working
- [ ] robots.txt allows indexing
- [ ] sitemap.xml includes page

**Accessibility Testing:**
- [ ] Keyboard navigation works
- [ ] Tab order logical
- [ ] Focus indicators visible
- [ ] Color contrast sufficient (4.5:1)
- [ ] ARIA labels present
- [ ] Screen reader tested (VoiceOver)
- [ ] Skip navigation link works
- [ ] All interactive elements labeled
- [ ] Form fields have labels
- [ ] No ARIA errors
- [ ] Headings properly nested

**Cross-Browser Testing:**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

**Device Testing:**
- [ ] iPhone SE (375x667)
- [ ] iPhone 12/13/14 (390x844)
- [ ] iPhone 14 Pro Max (430x932)
- [ ] iPad (768x1024)
- [ ] iPad Pro (1024x1366)
- [ ] Samsung Galaxy S21 (360x800)
- [ ] Desktop 1920x1080
- [ ] Desktop 2560x1440

### A/B Testing Strategy

**Test Variations:**

1. **Hero Headline:**
   - A: "Master Japanese with YouTube Shadowing & Visual Kanji Connections"
   - B: "The Only Japanese App with YouTube Shadowing & Kanji Connection Network"

2. **Primary CTA:**
   - A: "Start Learning Free"
   - B: "Try Moshimoshi Free"

3. **Feature Order:**
   - A: YouTube → Kanji → Anki → Textbook
   - B: Anki → YouTube → Kanji → Textbook

4. **Social Proof Position:**
   - A: After core features
   - B: After Blue Ocean features

**Tracking Metrics:**
```typescript
// Google Analytics events

// Page load
gtag('event', 'page_view', {
  page_title: 'Landing Page',
  page_location: window.location.href
});

// CTA clicks
gtag('event', 'cta_click', {
  cta_location: 'hero',
  cta_text: 'Start Learning Free',
  destination: '/signup'
});

// Feature interactions
gtag('event', 'feature_interaction', {
  feature_name: 'YouTube Shadowing',
  interaction_type: 'demo_click'
});

// Scroll depth
gtag('event', 'scroll', {
  percent_scrolled: 50
});
```

### Success Criteria

**Week 1 Targets:**
- Bounce rate: <30%
- Average time on page: >2 minutes
- Signup conversion: >5%
- Lighthouse score: >90 (all categories)

**Month 1 Targets:**
- Bounce rate: <25%
- Average time on page: >3 minutes
- Signup conversion: >8%
- Organic traffic: +50% from baseline
- Featured in search results for target keywords

### Post-Launch Monitoring

**Daily:**
- Check Core Web Vitals
- Monitor error logs
- Review user recordings (Hotjar/FullStory)
- Check conversion funnel

**Weekly:**
- Review heatmaps
- Analyze scroll depth
- Check A/B test results
- Review user feedback

**Monthly:**
- Comprehensive analytics review
- Update testimonials
- Refresh statistics
- Optimize underperforming sections

---

## APPENDIX: QUICK REFERENCE

### Color Palette Quick Copy

```css
/* Primary */
--indigo-600: #4f46e5
--purple-600: #9333ea

/* Success */
--green-500: #10b981

/* Japanese */
--sakura: #ffb7c5
--mizu: #a8dadc
--matcha: #95d5b2
--zen: #e9c46a

/* Neutrals */
--gray-50: #f9fafb
--gray-100: #f3f4f6
--gray-600: #4b5563
--gray-900: #111827
```

### Icon Library

Using **Lucide React**:
```tsx
import {
  ArrowRight,
  Check,
  ChevronDown,
  Play,
  Star,
  Upload,
  X,
  Menu,
  Zap,
  Award,
  Gamepad2,
  BookOpen,
  Search,
  TrendingUp,
  Volume2,
  Twitter,
  MessageCircle,
  Github
} from 'lucide-react';
```

### Common Spacing Values

```tsx
// Padding
p-4   // 16px
p-6   // 24px
p-8   // 32px

// Margin
mb-4  // 16px bottom
mb-8  // 32px bottom
mb-12 // 48px bottom

// Gap
gap-4  // 16px
gap-8  // 32px
gap-12 // 48px
```

### Responsive Breakpoints Quick Reference

```tsx
// Mobile: default (no prefix)
// Tablet: md: (768px+)
// Desktop: lg: (1024px+)
// Large Desktop: xl: (1280px+)

<div className="
  text-2xl     // Mobile
  md:text-4xl  // Tablet
  lg:text-5xl  // Desktop
">
  Responsive Text
</div>
```

### Animation Presets

```tsx
// Fade in on scroll
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.5 }}
>

// Hover scale
<motion.div
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>

// Stagger children
<motion.div
  variants={{
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } }
  }}
>
```

---

## FINAL NOTES FOR DEVELOPER

### Implementation Priority

1. **Phase 1 (Core Structure) - 2-3 hours:**
   - Set up page structure
   - Create basic components (Header, Footer, sections)
   - Implement responsive layout

2. **Phase 2 (Content & Styling) - 3-4 hours:**
   - Add all content
   - Style components
   - Implement dark mode
   - Add images

3. **Phase 3 (Interactions) - 2-3 hours:**
   - Add animations with Framer Motion
   - Implement carousel
   - Add smooth scroll
   - Mobile menu

4. **Phase 4 (Polish & Optimization) - 2-3 hours:**
   - Image optimization
   - Performance tuning
   - Accessibility audit
   - Cross-browser testing

### Questions to Ask Before Starting

1. Do we have all image assets ready? (demos, testimonials, icons)
2. Are testimonials real or placeholder?
3. Should pricing be hardcoded or fetched from API?
4. Which analytics platform? (GA4, Plausible, etc.)
5. A/B testing tool preference? (Vercel, Google Optimize, etc.)

### Support Resources

- **Design System:** Use existing Tailwind config in `/src/styles/globals.css`
- **Components:** Leverage existing Button, Card components
- **Icons:** Lucide React (already installed)
- **Animations:** Framer Motion (installed: `framer-motion@^12.23.12`)
- **Images:** Use Next.js Image component for optimization

### Estimated Timeline

- **Senior Developer:** 8-12 hours
- **Mid-Level Developer:** 12-16 hours
- **With existing components:** -20% time
- **With image assets ready:** -15% time

---

**Document Version:** 1.0
**Last Updated:** 2025-10-30
**Created By:** Claude (AI UX/UI Specialist)
**Ready for Implementation:** Yes

**Next Steps:**
1. Review this spec with stakeholders
2. Prepare image assets
3. Assign to senior front-end developer
4. Schedule 2-day sprint
5. Deploy to staging for review
6. Launch! 🚀
