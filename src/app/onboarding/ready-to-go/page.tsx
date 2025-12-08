'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircleIcon } from '@heroicons/react/24/solid'

const ReadyToGoPage = () => {
  const router = useRouter()

  const handleGoToDashboard = () => {
    // ========================================================================
    // **IMPORTANT FOR FULL IMPLEMENTATION**
    //
    // At this point, we should make an API call to a server-side endpoint
    // to permanently set a flag in the user's database profile,
    // for example: `onboardingCompleted: true`.
    //
    // This flag is checked in `src/app/(home)/page.tsx`.
    //
    // For this demonstration, we are just redirecting the user.
    // ========================================================================
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-lg">
        <CheckCircleIcon className="w-24 h-24 text-green-500 mx-auto mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">You&apos;re all set!</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
          You&apos;ve successfully set up your profile. Get ready to start your Japanese learning
          adventure!
        </p>
        <Button
          onClick={handleGoToDashboard}
          className="bg-green-600 hover:bg-green-700 text-white text-xl py-6 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all"
        >
          Go to my Dashboard
        </Button>
      </div>
    </div>
  )
}

export default ReadyToGoPage
