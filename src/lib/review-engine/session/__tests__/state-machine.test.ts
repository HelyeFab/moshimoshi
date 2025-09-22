/**
 * SessionStateMachine Tests
 * Agent 2: Core Systems Tester
 * 
 * Testing state transitions, guards, and state machine behavior
 */

import { 
  SessionStateMachine, 
  SessionState, 
  SessionAction,
  StateTransition,
  createSessionStateMachine,
  StateUtils
} from '../state-machine';

describe('SessionStateMachine', () => {
  let stateMachine: SessionStateMachine;
  let stateChangeHandler: jest.Mock;
  let invalidTransitionHandler: jest.Mock;

  beforeEach(() => {
    stateChangeHandler = jest.fn();
    invalidTransitionHandler = jest.fn();
    
    stateMachine = new SessionStateMachine({
      initialState: SessionState.IDLE,
      onStateChange: stateChangeHandler,
      onInvalidTransition: invalidTransitionHandler,
      debug: false
    });
  });

  describe('Initial State', () => {
    it('should start in IDLE state', () => {
      expect(stateMachine.getState()).toBe(SessionState.IDLE);
    });

    it('should allow custom initial state', () => {
      const customMachine = new SessionStateMachine({
        initialState: SessionState.ACTIVE
      });
      
      expect(customMachine.getState()).toBe(SessionState.ACTIVE);
    });
  });

  describe('Valid State Transitions', () => {
    describe('From IDLE', () => {
      it('should transition IDLE -> STARTING on START', () => {
        const newState = stateMachine.transition(SessionAction.START);
        
        expect(newState).toBe(SessionState.STARTING);
        expect(stateMachine.getState()).toBe(SessionState.STARTING);
        expect(stateChangeHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            from: SessionState.IDLE,
            to: SessionState.STARTING,
            action: SessionAction.START
          })
        );
      });

      it('should allow IDLE -> IDLE on RESET', () => {
        const newState = stateMachine.transition(SessionAction.RESET);
        
        expect(newState).toBe(SessionState.IDLE);
        expect(stateChangeHandler).toHaveBeenCalled();
      });
    });

    describe('From STARTING', () => {
      beforeEach(() => {
        stateMachine.transition(SessionAction.START);
      });

      it('should transition STARTING -> ACTIVE on START', () => {
        const newState = stateMachine.transition(SessionAction.START);
        
        expect(newState).toBe(SessionState.ACTIVE);
      });

      it('should transition STARTING -> ERROR on ERROR', () => {
        const newState = stateMachine.transition(SessionAction.ERROR);
        
        expect(newState).toBe(SessionState.ERROR);
      });

      it('should transition STARTING -> ABANDONED on ABANDON', () => {
        const newState = stateMachine.transition(SessionAction.ABANDON);
        
        expect(newState).toBe(SessionState.ABANDONED);
      });
    });

    describe('From ACTIVE', () => {
      beforeEach(() => {
        stateMachine.transition(SessionAction.START);
        stateMachine.transition(SessionAction.START);
      });

      it('should transition ACTIVE -> PAUSED on PAUSE', () => {
        const newState = stateMachine.transition(SessionAction.PAUSE);
        
        expect(newState).toBe(SessionState.PAUSED);
      });

      it('should stay ACTIVE on ANSWER', () => {
        const newState = stateMachine.transition(SessionAction.ANSWER, {
          hasCurrentItem: true
        });
        
        expect(newState).toBe(SessionState.ACTIVE);
      });

      it('should stay ACTIVE on SKIP', () => {
        const newState = stateMachine.transition(SessionAction.SKIP, {
          hasCurrentItem: true
        });
        
        expect(newState).toBe(SessionState.ACTIVE);
      });

      it('should transition ACTIVE -> COMPLETING on COMPLETE', () => {
        const newState = stateMachine.transition(SessionAction.COMPLETE, {
          allItemsReviewed: true
        });
        
        expect(newState).toBe(SessionState.COMPLETING);
      });

      it('should transition ACTIVE -> ABANDONED on ABANDON', () => {
        const newState = stateMachine.transition(SessionAction.ABANDON);
        
        expect(newState).toBe(SessionState.ABANDONED);
      });

      it('should transition ACTIVE -> ERROR on ERROR', () => {
        const newState = stateMachine.transition(SessionAction.ERROR);
        
        expect(newState).toBe(SessionState.ERROR);
      });
    });

    describe('From PAUSED', () => {
      beforeEach(() => {
        stateMachine.transition(SessionAction.START);
        stateMachine.transition(SessionAction.START);
        stateMachine.transition(SessionAction.PAUSE);
      });

      it('should transition PAUSED -> ACTIVE on RESUME', () => {
        const newState = stateMachine.transition(SessionAction.RESUME);
        
        expect(newState).toBe(SessionState.ACTIVE);
      });

      it('should transition PAUSED -> ABANDONED on ABANDON', () => {
        const newState = stateMachine.transition(SessionAction.ABANDON);
        
        expect(newState).toBe(SessionState.ABANDONED);
      });

      it('should transition PAUSED -> COMPLETING on COMPLETE', () => {
        const newState = stateMachine.transition(SessionAction.COMPLETE, {
          allItemsReviewed: true
        });
        
        expect(newState).toBe(SessionState.COMPLETING);
      });
    });

    describe('From COMPLETING', () => {
      beforeEach(() => {
        stateMachine.transition(SessionAction.START);
        stateMachine.transition(SessionAction.START);
        stateMachine.transition(SessionAction.COMPLETE, { allItemsReviewed: true });
      });

      it('should transition COMPLETING -> COMPLETED on COMPLETE', () => {
        const newState = stateMachine.transition(SessionAction.COMPLETE);
        
        expect(newState).toBe(SessionState.COMPLETED);
      });

      it('should transition COMPLETING -> ERROR on ERROR', () => {
        const newState = stateMachine.transition(SessionAction.ERROR);
        
        expect(newState).toBe(SessionState.ERROR);
      });
    });

    describe('From COMPLETED', () => {
      beforeEach(() => {
        stateMachine.transition(SessionAction.START);
        stateMachine.transition(SessionAction.START);
        stateMachine.transition(SessionAction.COMPLETE, { allItemsReviewed: true });
        stateMachine.transition(SessionAction.COMPLETE);
      });

      it('should transition COMPLETED -> STARTING on START', () => {
        const newState = stateMachine.transition(SessionAction.START);
        
        expect(newState).toBe(SessionState.STARTING);
      });

      it('should transition COMPLETED -> IDLE on RESET', () => {
        const newState = stateMachine.transition(SessionAction.RESET);
        
        expect(newState).toBe(SessionState.IDLE);
      });
    });

    describe('From ABANDONED', () => {
      beforeEach(() => {
        stateMachine.transition(SessionAction.START);
        stateMachine.transition(SessionAction.START);
        stateMachine.transition(SessionAction.ABANDON);
      });

      it('should transition ABANDONED -> STARTING on START', () => {
        const newState = stateMachine.transition(SessionAction.START);
        
        expect(newState).toBe(SessionState.STARTING);
      });

      it('should transition ABANDONED -> IDLE on RESET', () => {
        const newState = stateMachine.transition(SessionAction.RESET);
        
        expect(newState).toBe(SessionState.IDLE);
      });
    });

    describe('From ERROR', () => {
      beforeEach(() => {
        stateMachine.transition(SessionAction.START);
        stateMachine.transition(SessionAction.ERROR);
      });

      it('should transition ERROR -> STARTING on START', () => {
        const newState = stateMachine.transition(SessionAction.START);
        
        expect(newState).toBe(SessionState.STARTING);
      });

      it('should transition ERROR -> ABANDONED on ABANDON', () => {
        const newState = stateMachine.transition(SessionAction.ABANDON);
        
        expect(newState).toBe(SessionState.ABANDONED);
      });

      it('should transition ERROR -> IDLE on RESET', () => {
        const newState = stateMachine.transition(SessionAction.RESET);
        
        expect(newState).toBe(SessionState.IDLE);
      });
    });
  });

  describe('Invalid State Transitions', () => {
    it('should handle invalid transition from IDLE', () => {
      const newState = stateMachine.transition(SessionAction.PAUSE);
      
      expect(newState).toBe(SessionState.IDLE); // No change
      expect(invalidTransitionHandler).toHaveBeenCalledWith(
        SessionState.IDLE,
        SessionAction.PAUSE
      );
    });

    it('should handle invalid transition from ACTIVE', () => {
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.START);
      
      const newState = stateMachine.transition(SessionAction.RESUME);
      
      expect(newState).toBe(SessionState.ACTIVE); // No change
      expect(invalidTransitionHandler).toHaveBeenCalled();
    });

    it('should handle invalid transition from COMPLETED', () => {
      stateMachine.forceState(SessionState.COMPLETED);
      
      const newState = stateMachine.transition(SessionAction.PAUSE);
      
      expect(newState).toBe(SessionState.COMPLETED); // No change
      expect(invalidTransitionHandler).toHaveBeenCalled();
    });
  });

  describe('Guards', () => {
    beforeEach(() => {
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.START);
    });

    describe('COMPLETE guard', () => {
      it('should block COMPLETE if not all items reviewed', () => {
        const newState = stateMachine.transition(SessionAction.COMPLETE, {
          allItemsReviewed: false
        });
        
        expect(newState).toBe(SessionState.ACTIVE); // No change
      });

      it('should allow COMPLETE if all items reviewed', () => {
        const newState = stateMachine.transition(SessionAction.COMPLETE, {
          allItemsReviewed: true
        });
        
        expect(newState).toBe(SessionState.COMPLETING);
      });

      it('should block COMPLETE with no metadata', () => {
        const newState = stateMachine.transition(SessionAction.COMPLETE);
        
        expect(newState).toBe(SessionState.ACTIVE); // No change
      });
    });

    describe('ANSWER guard', () => {
      it('should block ANSWER if no current item', () => {
        const newState = stateMachine.transition(SessionAction.ANSWER, {
          hasCurrentItem: false
        });
        
        expect(newState).toBe(SessionState.ACTIVE); // No change
      });

      it('should allow ANSWER if has current item', () => {
        const newState = stateMachine.transition(SessionAction.ANSWER, {
          hasCurrentItem: true
        });
        
        expect(newState).toBe(SessionState.ACTIVE);
        expect(stateChangeHandler).toHaveBeenCalled();
      });
    });

    describe('SKIP guard', () => {
      it('should block SKIP if no current item', () => {
        const newState = stateMachine.transition(SessionAction.SKIP, {
          hasCurrentItem: false
        });
        
        expect(newState).toBe(SessionState.ACTIVE); // No change
      });

      it('should allow SKIP if has current item', () => {
        const newState = stateMachine.transition(SessionAction.SKIP, {
          hasCurrentItem: true
        });
        
        expect(newState).toBe(SessionState.ACTIVE);
        expect(stateChangeHandler).toHaveBeenCalled();
      });
    });
  });

  describe('State Queries', () => {
    it('should check if can transition', () => {
      expect(stateMachine.canTransition(SessionAction.START)).toBe(true);
      expect(stateMachine.canTransition(SessionAction.PAUSE)).toBe(false);
      
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.START);
      
      expect(stateMachine.canTransition(SessionAction.PAUSE)).toBe(true);
      expect(stateMachine.canTransition(SessionAction.RESUME)).toBe(false);
    });

    it('should check guards in canTransition', () => {
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.START);
      
      expect(stateMachine.canTransition(SessionAction.COMPLETE, {
        allItemsReviewed: false
      })).toBe(false);
      
      expect(stateMachine.canTransition(SessionAction.COMPLETE, {
        allItemsReviewed: true
      })).toBe(true);
    });

    it('should get valid actions from current state', () => {
      expect(stateMachine.getValidActions()).toEqual([
        SessionAction.START,
        SessionAction.RESET
      ]);
      
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.START);
      
      expect(stateMachine.getValidActions()).toEqual([
        SessionAction.PAUSE,
        SessionAction.ANSWER,
        SessionAction.SKIP,
        SessionAction.COMPLETE,
        SessionAction.ABANDON,
        SessionAction.ERROR
      ]);
    });

    it('should check if in specific state', () => {
      expect(stateMachine.isInState(SessionState.IDLE)).toBe(true);
      expect(stateMachine.isInState(SessionState.ACTIVE)).toBe(false);
      
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.START);
      
      expect(stateMachine.isInState(SessionState.IDLE)).toBe(false);
      expect(stateMachine.isInState(SessionState.ACTIVE)).toBe(true);
    });

    it('should check if in any of multiple states', () => {
      expect(stateMachine.isInAnyState(
        SessionState.IDLE,
        SessionState.ACTIVE
      )).toBe(true);
      
      expect(stateMachine.isInAnyState(
        SessionState.PAUSED,
        SessionState.COMPLETED
      )).toBe(false);
    });

    it('should check if active', () => {
      expect(stateMachine.isActive()).toBe(false);
      
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.START);
      
      expect(stateMachine.isActive()).toBe(true);
      
      stateMachine.transition(SessionAction.PAUSE);
      
      expect(stateMachine.isActive()).toBe(false);
    });

    it('should check if terminal', () => {
      expect(stateMachine.isTerminal()).toBe(false);
      
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.ABANDON);
      
      expect(stateMachine.isTerminal()).toBe(true);
    });

    it('should check if can resume', () => {
      expect(stateMachine.canResume()).toBe(false);
      
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.PAUSE);
      
      expect(stateMachine.canResume()).toBe(true);
    });
  });

  describe('History Tracking', () => {
    it('should track transition history', () => {
      expect(stateMachine.getHistory()).toHaveLength(0);
      
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.PAUSE);
      
      const history = stateMachine.getHistory();
      expect(history).toHaveLength(3);
      
      expect(history[0]).toMatchObject({
        from: SessionState.IDLE,
        to: SessionState.STARTING,
        action: SessionAction.START
      });
      
      expect(history[1]).toMatchObject({
        from: SessionState.STARTING,
        to: SessionState.ACTIVE,
        action: SessionAction.START
      });
      
      expect(history[2]).toMatchObject({
        from: SessionState.ACTIVE,
        to: SessionState.PAUSED,
        action: SessionAction.PAUSE
      });
    });

    it('should get last transition', () => {
      expect(stateMachine.getLastTransition()).toBeNull();
      
      stateMachine.transition(SessionAction.START);
      
      const lastTransition = stateMachine.getLastTransition();
      expect(lastTransition).toMatchObject({
        from: SessionState.IDLE,
        to: SessionState.STARTING,
        action: SessionAction.START
      });
    });

    it('should include metadata in history', () => {
      stateMachine.transition(SessionAction.START, { userId: '123' });
      
      const history = stateMachine.getHistory();
      expect(history[0].metadata).toEqual({ userId: '123' });
    });

    it('should track timestamps in history', () => {
      const before = Date.now();
      
      stateMachine.transition(SessionAction.START);
      
      const after = Date.now();
      const transition = stateMachine.getLastTransition()!;
      
      expect(transition.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(transition.timestamp.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to initial state', () => {
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.PAUSE);
      
      expect(stateMachine.getState()).toBe(SessionState.PAUSED);
      expect(stateMachine.getHistory()).toHaveLength(3);
      
      stateMachine.reset();
      
      expect(stateMachine.getState()).toBe(SessionState.IDLE);
      expect(stateMachine.getHistory()).toHaveLength(0);
    });

    it('should emit state change on reset', () => {
      stateMachine.transition(SessionAction.START);
      
      stateChangeHandler.mockClear();
      stateMachine.reset();
      
      expect(stateChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          from: SessionState.STARTING,
          to: SessionState.IDLE,
          action: SessionAction.RESET
        })
      );
    });
  });

  describe('Force State', () => {
    it('should force state change bypassing validation', () => {
      stateMachine.forceState(SessionState.COMPLETED);
      
      expect(stateMachine.getState()).toBe(SessionState.COMPLETED);
    });

    it('should add forced transition to history', () => {
      stateMachine.forceState(SessionState.ACTIVE);
      
      const lastTransition = stateMachine.getLastTransition()!;
      expect(lastTransition).toMatchObject({
        from: SessionState.IDLE,
        to: SessionState.ACTIVE,
        action: SessionAction.RESET,
        metadata: { forced: true }
      });
    });

    it('should log warning in debug mode', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const debugMachine = new SessionStateMachine({ debug: true });
      debugMachine.forceState(SessionState.ERROR);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Forcing state transition')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('State Metadata', () => {
    it('should provide comprehensive state metadata', () => {
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.START);
      
      const metadata = stateMachine.getStateMetadata();
      
      expect(metadata).toMatchObject({
        state: SessionState.ACTIVE,
        isActive: true,
        isTerminal: false,
        canResume: false,
        validActions: expect.arrayContaining([
          SessionAction.PAUSE,
          SessionAction.ANSWER,
          SessionAction.SKIP
        ]),
        transitionCount: 2,
        timeInState: expect.any(Number)
      });
    });

    it('should calculate time in state', async () => {
      stateMachine.transition(SessionAction.START);
      
      // Wait 100ms
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const metadata = stateMachine.getStateMetadata();
      expect(metadata.timeInState).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Debug Mode', () => {
    let consoleSpy: jest.SpyInstance;
    let debugMachine: SessionStateMachine;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      debugMachine = new SessionStateMachine({ debug: true });
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log state transitions in debug mode', () => {
      debugMachine.transition(SessionAction.START);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('State transition: idle -> starting (START)')
      );
    });

    it('should warn about failed guards in debug mode', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      debugMachine.transition(SessionAction.START);
      debugMachine.transition(SessionAction.START);
      debugMachine.transition(SessionAction.COMPLETE); // No metadata
      
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Guard failed for action COMPLETE')
      );
      
      warnSpy.mockRestore();
    });

    it('should log invalid transitions in debug mode', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      debugMachine.transition(SessionAction.PAUSE); // Invalid from IDLE
      
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid transition: PAUSE from state idle')
      );
      
      errorSpy.mockRestore();
    });
  });

  describe('StateUtils', () => {
    describe('isInteractive', () => {
      it('should identify interactive states', () => {
        expect(StateUtils.isInteractive(SessionState.ACTIVE)).toBe(true);
        expect(StateUtils.isInteractive(SessionState.IDLE)).toBe(false);
        expect(StateUtils.isInteractive(SessionState.PAUSED)).toBe(false);
        expect(StateUtils.isInteractive(SessionState.COMPLETED)).toBe(false);
      });
    });

    describe('isTransitional', () => {
      it('should identify transitional states', () => {
        expect(StateUtils.isTransitional(SessionState.STARTING)).toBe(true);
        expect(StateUtils.isTransitional(SessionState.COMPLETING)).toBe(true);
        expect(StateUtils.isTransitional(SessionState.ACTIVE)).toBe(false);
        expect(StateUtils.isTransitional(SessionState.IDLE)).toBe(false);
      });
    });

    describe('isError', () => {
      it('should identify error state', () => {
        expect(StateUtils.isError(SessionState.ERROR)).toBe(true);
        expect(StateUtils.isError(SessionState.ACTIVE)).toBe(false);
        expect(StateUtils.isError(SessionState.ABANDONED)).toBe(false);
      });
    });

    describe('getDisplayName', () => {
      it('should return human-readable state names', () => {
        expect(StateUtils.getDisplayName(SessionState.IDLE)).toBe('Ready');
        expect(StateUtils.getDisplayName(SessionState.ACTIVE)).toBe('In Progress');
        expect(StateUtils.getDisplayName(SessionState.PAUSED)).toBe('Paused');
        expect(StateUtils.getDisplayName(SessionState.COMPLETED)).toBe('Completed');
        expect(StateUtils.getDisplayName(SessionState.ERROR)).toBe('Error');
      });
    });

    describe('getStateColor', () => {
      it('should return appropriate colors for states', () => {
        expect(StateUtils.getStateColor(SessionState.IDLE)).toBe('gray');
        expect(StateUtils.getStateColor(SessionState.ACTIVE)).toBe('green');
        expect(StateUtils.getStateColor(SessionState.PAUSED)).toBe('yellow');
        expect(StateUtils.getStateColor(SessionState.ERROR)).toBe('red');
        expect(StateUtils.getStateColor(SessionState.COMPLETED)).toBe('green');
      });
    });
  });

  describe('Factory Function', () => {
    it('should create state machine with common configuration', () => {
      const onStateChange = jest.fn();
      const machine = createSessionStateMachine(onStateChange, true);
      
      machine.transition(SessionAction.START);
      
      expect(onStateChange).toHaveBeenCalled();
      expect(machine.getState()).toBe(SessionState.STARTING);
    });

    it('should set up invalid transition handler', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const machine = createSessionStateMachine();
      machine.transition(SessionAction.PAUSE); // Invalid from IDLE
      
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid state transition attempted')
      );
      
      warnSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid state changes', () => {
      // Simulate rapid user actions
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.PAUSE);
      stateMachine.transition(SessionAction.RESUME);
      stateMachine.transition(SessionAction.PAUSE);
      stateMachine.transition(SessionAction.RESUME);
      
      expect(stateMachine.getState()).toBe(SessionState.ACTIVE);
      expect(stateMachine.getHistory()).toHaveLength(6);
    });

    it('should handle concurrent guard checks', () => {
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.START);
      
      // Multiple guard checks
      const canAnswer = stateMachine.canTransition(SessionAction.ANSWER, { hasCurrentItem: true });
      const canSkip = stateMachine.canTransition(SessionAction.SKIP, { hasCurrentItem: true });
      const canComplete = stateMachine.canTransition(SessionAction.COMPLETE, { allItemsReviewed: false });
      
      expect(canAnswer).toBe(true);
      expect(canSkip).toBe(true);
      expect(canComplete).toBe(false);
    });

    it('should maintain state consistency after errors', () => {
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.ERROR);
      
      expect(stateMachine.getState()).toBe(SessionState.ERROR);
      
      // Can recover from error
      stateMachine.transition(SessionAction.START);
      expect(stateMachine.getState()).toBe(SessionState.STARTING);
    });

    it('should handle undefined metadata gracefully', () => {
      stateMachine.transition(SessionAction.START);
      stateMachine.transition(SessionAction.START);
      
      const newState = stateMachine.transition(SessionAction.ANSWER, undefined);
      
      expect(newState).toBe(SessionState.ACTIVE); // Guard should fail
    });
  });
});