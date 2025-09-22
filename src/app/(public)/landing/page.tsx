
import React from 'react';
import Logo from '@/components/ui/Logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/FeatureCard';
import ThemeToggle from '@/components/ui/ThemeToggle';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
      {/* Header */}
      <header className="container mx-auto px-6 py-4 flex justify-between items-center">
        <Logo />
        <nav className="flex items-center gap-4">
          <ThemeToggle />
          <Button className="bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white">Login</Button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold mb-4">Master Japanese, from Kana to Kanji.</h1>
        <p className="text-xl mb-8">Your personalized journey to fluency starts here. Interactive lessons, real-world conversations, and a vibrant community.</p>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-xl py-4 px-8">Start Learning for Free</Button>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 dark:bg-gray-800 py-20 transition-colors duration-300">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-12">Why MoshiMoshi?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-white dark:bg-gray-700 text-center shadow-lg dark:shadow-none transition-colors duration-300">
              <h3 className="text-2xl font-bold mb-4">Interactive Lessons</h3>
              <p>Learn through engaging exercises, quizzes, and games that make learning fun and effective.</p>
            </Card>
            <Card className="bg-white dark:bg-gray-700 text-center shadow-lg dark:shadow-none transition-colors duration-300">
              <h3 className="text-2xl font-bold mb-4">Personalized Path</h3>
              <p>Our AI-powered system adapts to your learning style and pace, creating a unique curriculum just for you.</p>
            </Card>
            <Card className="bg-white dark:bg-gray-700 text-center shadow-lg dark:shadow-none transition-colors duration-300">
              <h3 className="text-2xl font-bold mb-4">Live Conversations</h3>
              <p>Practice speaking with native speakers and fellow learners in our virtual classrooms.</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-white dark:bg-gray-900 py-20 transition-colors duration-300">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-12">What Our Learners Say</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-gray-100 dark:bg-gray-800 transition-colors duration-300">
              <p className="mb-4">&#34;MoshiMoshi has been a game-changer for my Japanese. The lessons are fun and I can practice speaking whenever I want.&#34;</p>
              <p className="font-bold">- Sarah, Student</p>
            </Card>
            <Card className="bg-gray-100 dark:bg-gray-800 transition-colors duration-300">
              <p className="mb-4">&#34;I&apos;ve tried other apps, but none have the depth and personalization of MoshiMoshi. I&apos;m finally confident in my ability to speak Japanese.&#34;</p>
              <p className="font-bold">- Mike, Software Engineer</p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-indigo-600 dark:bg-indigo-700 py-20 text-center transition-colors duration-300">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold mb-4">Ready to Start Your Journey?</h2>
          <p className="text-xl mb-8">Join thousands of learners and start speaking Japanese from day one.</p>
          <Button className="bg-white text-indigo-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 text-xl py-4 px-8 transition-colors duration-300">Sign Up Now</Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 dark:bg-gray-900 py-6 transition-colors duration-300">
        <div className="container mx-auto px-6 text-center text-gray-600 dark:text-gray-400">
          &copy; 2025 MoshiMoshi. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
