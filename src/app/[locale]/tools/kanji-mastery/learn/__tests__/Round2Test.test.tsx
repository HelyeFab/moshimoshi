/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, fireEvent, screen } from '@testing-library/react'
import Round2Test from '../components/Round2Test'
import type { KanjiWithExamples } from '../LearnContent'

jest.mock('../testOrder', () => ({
  buildRound2TestSequence: jest.fn(() => [
    { type: 'meaning', question: 'Meaning Q', answer: 'sun' }
  ])
}))

const makeKanji = (): KanjiWithExamples => ({
  kanji: '日',
  meaning: 'sun',
  meanings: ['sun'],
  onyomi: ['ニチ'],
  kunyomi: ['ひ'],
  jlpt: 'N5',
  strokeCount: 4,
  examples: []
})

describe('Round2Test', () => {
  it('reports results in order and returns final test type', () => {
    const onComplete = jest.fn()
    const kanji = makeKanji()

    render(
      <Round2Test
        kanji={kanji}
        currentIndex={0}
        totalKanji={1}
        onComplete={onComplete}
        onExit={jest.fn()}
        testMode="recall"
        distractorPool={[]}
        enableRandomizedOrder={true}
        lastTestType={null}
      />
    )

    const input = screen.getByPlaceholderText('Type your answer...')
    fireEvent.change(input, { target: { value: 'sun' } })

    const checkButton = screen.getByLabelText('Check answer')
    fireEvent.click(checkButton)

    const continueButton = screen.getByLabelText('Continue')
    fireEvent.click(continueButton)

    expect(onComplete).toHaveBeenCalledTimes(1)
    const [results, finalType] = onComplete.mock.calls[0]
    expect(results[0].type).toBe('meaning')
    expect(finalType).toBe('meaning')
  })
})
