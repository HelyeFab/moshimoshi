'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';

export default function TestFlashcardsPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);

  const addResult = (test: string, passed: boolean, details?: string) => {
    setResults(prev => [...prev, { test, passed, details, timestamp: Date.now() }]);
  };

  const runTests = async () => {
    if (!user) {
      alert('Please sign in first to test authenticated endpoints');
      return;
    }

    setTesting(true);
    setResults([]);

    try {
      // Test 1: GET all decks
      addResult('GET /api/flashcards/decks', false, 'Starting...');
      const getDecksRes = await fetch('/api/flashcards/decks');
      const decksData = await getDecksRes.json();
      addResult('GET /api/flashcards/decks', getDecksRes.ok, `Status: ${getDecksRes.status}, Decks: ${decksData.decks?.length || 0}`);

      // Test 2: Create a deck
      const testDeck = {
        name: `Test Deck ${Date.now()}`,
        description: 'Testing Firebase integration',
        emoji: '🧪',
        color: 'primary',
        cardStyle: 'minimal',
        initialCards: [
          { front: 'Test Front 1', back: 'Test Back 1' },
          { front: 'Test Front 2', back: 'Test Back 2' }
        ]
      };

      addResult('POST /api/flashcards/decks', false, 'Creating deck...');
      const createRes = await fetch('/api/flashcards/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testDeck)
      });
      const createdDeck = await createRes.json();
      addResult('POST /api/flashcards/decks', createRes.ok, `Status: ${createRes.status}, Deck ID: ${createdDeck.deck?.id || 'none'}`);

      if (createRes.ok && createdDeck.deck) {
        const deckId = createdDeck.deck.id;

        // Test 3: Get specific deck
        addResult(`GET /api/flashcards/decks/${deckId}`, false, 'Fetching...');
        const getOneRes = await fetch(`/api/flashcards/decks/${deckId}`);
        const oneDeck = await getOneRes.json();
        addResult(`GET /api/flashcards/decks/${deckId}`, getOneRes.ok, `Status: ${getOneRes.status}, Name: ${oneDeck.deck?.name || 'none'}`);

        // Test 4: Update deck
        addResult(`PUT /api/flashcards/decks/${deckId}`, false, 'Updating...');
        const updateRes = await fetch(`/api/flashcards/decks/${deckId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Test Deck' })
        });
        const updatedDeck = await updateRes.json();
        addResult(`PUT /api/flashcards/decks/${deckId}`, updateRes.ok, `Status: ${updateRes.status}`);

        // Test 5: Add a card
        addResult(`POST /api/flashcards/decks/${deckId}/cards`, false, 'Adding card...');
        const addCardRes = await fetch(`/api/flashcards/decks/${deckId}/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ front: 'New Card Front', back: 'New Card Back' })
        });
        const addedCard = await addCardRes.json();
        addResult(`POST /api/flashcards/decks/${deckId}/cards`, addCardRes.ok, `Status: ${addCardRes.status}, Card ID: ${addedCard.card?.id || 'none'}`);

        // Test 6: Delete the deck
        addResult(`DELETE /api/flashcards/decks/${deckId}`, false, 'Deleting...');
        const deleteRes = await fetch(`/api/flashcards/decks/${deckId}`, {
          method: 'DELETE'
        });
        addResult(`DELETE /api/flashcards/decks/${deckId}`, deleteRes.ok, `Status: ${deleteRes.status}`);
      }

      // Test 7: Check Firebase persistence by getting all decks again
      addResult('Firebase Persistence Check', false, 'Checking...');
      const finalRes = await fetch('/api/flashcards/decks');
      const finalData = await finalRes.json();
      addResult('Firebase Persistence Check', finalRes.ok, `Total decks in Firebase: ${finalData.decks?.length || 0}`);

    } catch (error: any) {
      addResult('Error during tests', false, error.message);
    } finally {
      setTesting(false);
    }
  };

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-purple-50 dark:from-dark-900 dark:via-dark-850 dark:to-purple-900/10 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          🧪 Flashcards API & Firebase Test
        </h1>

        {!user ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 dark:text-yellow-200">
              ⚠️ Please sign in first to test authenticated endpoints
            </p>
          </div>
        ) : (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <p className="text-green-800 dark:text-green-200">
              ✅ Signed in as: {user.email} (UID: {user.uid})
            </p>
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={runTests}
          disabled={testing || !user}
          className="px-6 py-3 bg-gradient-to-r from-primary-500 to-purple-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed mb-6"
        >
          {testing ? 'Running Tests...' : 'Run All Tests'}
        </motion.button>

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex gap-4 mb-4">
              <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                ✅ Passed: {passed}
              </div>
              <div className="px-4 py-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                ❌ Failed: {failed}
              </div>
              <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                📊 Success Rate: {results.length > 0 ? Math.round((passed / results.length) * 100) : 0}%
              </div>
            </div>

            <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Test</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, idx) => (
                    <tr key={idx} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2 font-mono text-sm">{result.test}</td>
                      <td className="px-4 py-2">
                        {result.passed ? (
                          <span className="text-green-600 dark:text-green-400">✅ PASS</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">❌ FAIL</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                        {result.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}