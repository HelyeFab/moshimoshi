import Link from 'next/link';

export default function PricingTestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Pricing Page Comparison Test
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            English Copy Preview (Test)
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Free</h3>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>Start learning today</li>
                <li>Daily practice in kana, kanji, and drills</li>
                <li>Limited stories &amp; news</li>
                <li>Basic progress tracking</li>
                <li>Learn at your own pace</li>
              </ul>
            </div>

            <div className="rounded-xl border border-primary-500 p-6 bg-white dark:bg-gray-800 shadow-md">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Premium Monthly</h3>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>Everything in Free, plus:</li>
                <li>Learn faster with unlimited practice</li>
                <li>Read more with unlimited stories, news, and comics</li>
                <li>Go deeper with full Kanji Connection + Textbook Vocabulary</li>
                <li>Build real habits with unlimited drills &amp; mastery</li>
                <li>Keep progress everywhere with cross-device sync</li>
                <li>Priority support</li>
                <li>Every new feature included — always unlimited</li>
              </ul>
            </div>

            <div className="rounded-xl border border-green-500 p-6 bg-white dark:bg-gray-800 shadow-md">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Premium Yearly</h3>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>Everything in Premium Monthly</li>
                <li>Best value — save 7% (2 months free)</li>
                <li>Every new feature included — always unlimited</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
            ⚠️ Conflict Detected
          </h2>
          <p className="text-yellow-700 dark:text-yellow-400 mb-4">
            Two pricing page implementations exist with different filtering logic:
          </p>
          <ul className="list-disc list-inside space-y-2 text-yellow-700 dark:text-yellow-400 text-sm">
            <li>
              <strong>page.tsx (PricingContent)</strong>: Shows ALL 3 plans regardless of toggle
              <code className="ml-2 bg-yellow-100 dark:bg-yellow-900/50 px-2 py-1 rounded">
                displayedPlans = PRICING_PLANS
              </code>
            </li>
            <li>
              <strong>PricingPage.tsx</strong>: Filters plans based on billing interval toggle
              <code className="ml-2 bg-yellow-100 dark:bg-yellow-900/50 px-2 py-1 rounded">
                filter(plan =&gt; billingInterval logic)
              </code>
            </li>
          </ul>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Current Implementation */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border-2 border-blue-500">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Current Route
              </h2>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              <strong>File:</strong> <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                src/app/[locale]/pricing/page.tsx
              </code>
            </p>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Uses <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">PricingContent</code> component
              wrapped in Suspense. Shows all 3 plans simultaneously.
            </p>

            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4 mb-6">
              <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                Line 96:<br/>
                <code>const displayedPlans = PRICING_PLANS</code>
              </p>
            </div>

            <Link
              href="/en/pricing"
              className="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              View Current Implementation →
            </Link>
          </div>

          {/* Alternative Implementation */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border-2 border-purple-500">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Alternative Version
              </h2>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              <strong>File:</strong> <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                src/app/[locale]/pricing/PricingPage.tsx
              </code>
            </p>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Standalone component with billing interval filtering.
              Shows Free + either Monthly OR Yearly premium plan.
            </p>

            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4 mb-6">
              <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                Lines 85-89:<br/>
                <code>filter(plan =&gt; {'{'}...{'}'})</code>
              </p>
            </div>

            <Link
              href="/en/test-pricing/alternative"
              className="block w-full text-center bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              View Alternative Implementation →
            </Link>
          </div>
        </div>

        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-3">
            🔍 What to Look For:
          </h3>
          <ul className="space-y-2 text-blue-800 dark:text-blue-400">
            <li className="flex items-start gap-2">
              <span className="font-bold">1.</span>
              <span>Toggle the Monthly/Yearly switch on each page</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">2.</span>
              <span>Current implementation always shows 3 cards (Free, Premium Monthly, Premium Yearly)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">3.</span>
              <span>Alternative implementation shows 2 cards (Free + selected billing interval)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">4.</span>
              <span>Decide which behavior you prefer for production</span>
            </li>
          </ul>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/en"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 underline"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
