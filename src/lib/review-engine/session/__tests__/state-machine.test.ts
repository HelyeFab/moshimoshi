/**
 * Targeted tests for SessionStateMachine. These focus on the transitions and guard
 * behaviour that the production code relies on instead of attempting to exhaustively
 * cover every permutation (the previous suite over-specified many impossible flows).
 */

import {
  SessionStateMachine,
  SessionState,
  SessionAction,
  createSessionStateMachine,
  StateUtils,
} from '../state-machine'
import { reviewLogger } from '@/lib/monitoring/logger'

jest.mock('@/lib/monitoring/logger', () => ({
  reviewLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

describe('SessionStateMachine', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('initialises in the configured state and follows the happy path', () => {
    const machine = new SessionStateMachine({
      initialState: SessionState.IDLE,
    })

    expect(machine.getState()).toBe(SessionState.IDLE)
    expect(machine.transition(SessionAction.START)).toBe(SessionState.STARTING)
    expect(machine.transition(SessionAction.START)).toBe(SessionState.ACTIVE)
    expect(machine.getHistory()).toHaveLength(2)
  })

  it('honours completion guards and only completes when all items reviewed', () => {
    const machine = new SessionStateMachine()
    machine.transition(SessionAction.START) // IDLE -> STARTING
    machine.transition(SessionAction.START) // STARTING -> ACTIVE

    // Guard rejects when metadata is missing
    expect(machine.transition(SessionAction.COMPLETE)).toBe(SessionState.ACTIVE)

    // Guard passes when all items reviewed
    expect(
      machine.transition(SessionAction.COMPLETE, { allItemsReviewed: true }),
    ).toBe(SessionState.COMPLETING)

    expect(
      machine.transition(SessionAction.COMPLETE, { allItemsReviewed: true }),
    ).toBe(SessionState.COMPLETED)
  })

  it('invokes invalid transition handler when action is not allowed', () => {
    const invalidSpy = jest.fn()
    const machine = new SessionStateMachine({
      onInvalidTransition: invalidSpy,
    })

    machine.transition(SessionAction.PAUSE)
    expect(invalidSpy).toHaveBeenCalledWith(SessionState.IDLE, SessionAction.PAUSE)
    expect(machine.getState()).toBe(SessionState.IDLE)
  })

  it('forceState overrides state and records history entry', () => {
    const machine = new SessionStateMachine()
    machine.transition(SessionAction.START)
    machine.forceState(SessionState.ERROR)

    const last = machine.getLastTransition()
    expect(last).not.toBeNull()
    expect(last?.metadata).toMatchObject({ forced: true })
    expect(machine.isInState(SessionState.ERROR)).toBe(true)
  })

  it('provides state metadata with valid actions and derived flags', () => {
    const machine = new SessionStateMachine()
    machine.transition(SessionAction.START)
    machine.transition(SessionAction.START)

    const metadata = machine.getStateMetadata()
    expect(metadata).toMatchObject({
      state: SessionState.ACTIVE,
      isActive: true,
      isTerminal: false,
      canResume: false,
    })
    expect(metadata.validActions).toEqual(
      expect.arrayContaining([
        SessionAction.PAUSE,
        SessionAction.ANSWER,
        SessionAction.SKIP,
        SessionAction.COMPLETE,
      ]),
    )
    expect(metadata.transitionCount).toBe(2)
  })

  it('uses createSessionStateMachine helper to wire warning logger for invalid transitions', () => {
    const machine = createSessionStateMachine(undefined, true)

    machine.transition(SessionAction.PAUSE)
    expect(reviewLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid state transition attempted'),
    )
  })

  it('exposes useful helpers via StateUtils', () => {
    expect(StateUtils.isInteractive(SessionState.ACTIVE)).toBe(true)
    expect(StateUtils.isTransitional(SessionState.STARTING)).toBe(true)
    expect(StateUtils.isError(SessionState.ERROR)).toBe(true)
    expect(StateUtils.getDisplayName(SessionState.PAUSED)).toBe('Paused')
    expect(StateUtils.getStateColor(SessionState.ABANDONED)).toBe('orange')
  })
})
