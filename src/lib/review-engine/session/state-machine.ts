import { reviewLogger } from '@/lib/monitoring/logger';
/**
 * State machine for managing review session state transitions
 * Ensures valid state transitions and prevents invalid operations
 */

/**
 * All possible session states
 */
export enum SessionState {
  IDLE = 'idle',
  STARTING = 'starting',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETING = 'completing',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
  ERROR = 'error'
}

/**
 * All possible session actions
 */
export enum SessionAction {
  START = 'START',
  PAUSE = 'PAUSE',
  RESUME = 'RESUME',
  ANSWER = 'ANSWER',
  SKIP = 'SKIP',
  COMPLETE = 'COMPLETE',
  ABANDON = 'ABANDON',
  ERROR = 'ERROR',
  RESET = 'RESET'
}

/**
 * State transition event
 */
export interface StateTransition {
  from: SessionState;
  to: SessionState;
  action: SessionAction;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * State machine configuration
 */
export interface StateMachineConfig {
  initialState: SessionState;
  onStateChange?: (transition: StateTransition) => void;
  onInvalidTransition?: (from: SessionState, action: SessionAction) => void;
  debug?: boolean;
}

/**
 * Session state machine implementation
 */
export class SessionStateMachine {
  private state: SessionState;
  private history: StateTransition[] = [];
  private config: StateMachineConfig;
  
  /**
   * Define valid state transitions
   */
  private readonly transitions: Record<SessionState, Partial<Record<SessionAction, SessionState>>> = {
    [SessionState.IDLE]: {
      [SessionAction.START]: SessionState.STARTING,
      [SessionAction.RESET]: SessionState.IDLE
    },
    [SessionState.STARTING]: {
      [SessionAction.START]: SessionState.ACTIVE,
      [SessionAction.ERROR]: SessionState.ERROR,
      [SessionAction.ABANDON]: SessionState.ABANDONED
    },
    [SessionState.ACTIVE]: {
      [SessionAction.PAUSE]: SessionState.PAUSED,
      [SessionAction.ANSWER]: SessionState.ACTIVE,
      [SessionAction.SKIP]: SessionState.ACTIVE,
      [SessionAction.COMPLETE]: SessionState.COMPLETING,
      [SessionAction.ABANDON]: SessionState.ABANDONED,
      [SessionAction.ERROR]: SessionState.ERROR
    },
    [SessionState.PAUSED]: {
      [SessionAction.RESUME]: SessionState.ACTIVE,
      [SessionAction.ABANDON]: SessionState.ABANDONED,
      [SessionAction.COMPLETE]: SessionState.COMPLETING
    },
    [SessionState.COMPLETING]: {
      [SessionAction.COMPLETE]: SessionState.COMPLETED,
      [SessionAction.ERROR]: SessionState.ERROR
    },
    [SessionState.COMPLETED]: {
      [SessionAction.START]: SessionState.STARTING,
      [SessionAction.RESET]: SessionState.IDLE
    },
    [SessionState.ABANDONED]: {
      [SessionAction.START]: SessionState.STARTING,
      [SessionAction.RESET]: SessionState.IDLE
    },
    [SessionState.ERROR]: {
      [SessionAction.START]: SessionState.STARTING,
      [SessionAction.ABANDON]: SessionState.ABANDONED,
      [SessionAction.RESET]: SessionState.IDLE
    }
  };
  
  /**
   * Guards that must pass for transitions to occur
   */
  private readonly guards: Partial<Record<SessionAction, (metadata?: any) => boolean>> = {
    [SessionAction.COMPLETE]: (metadata) => {
      // Can only complete if all items are reviewed
      return metadata?.allItemsReviewed === true;
    },
    [SessionAction.ANSWER]: (metadata) => {
      // Must have a current item to answer
      return metadata?.hasCurrentItem === true;
    },
    [SessionAction.SKIP]: (metadata) => {
      // Must have a current item to skip
      return metadata?.hasCurrentItem === true;
    }
  };
  
  constructor(config: Partial<StateMachineConfig> = {}) {
    this.config = {
      initialState: SessionState.IDLE,
      debug: false,
      ...config
    };
    
    this.state = this.config.initialState;
  }
  
  /**
   * Attempt to transition to a new state
   */
  transition(action: SessionAction, metadata?: Record<string, any>): SessionState {
    const fromState = this.state;
    const validTransition = this.transitions[fromState]?.[action];
    
    if (!validTransition) {
      this.handleInvalidTransition(fromState, action);
      return this.state;
    }
    
    // Check guards
    const guard = this.guards[action];
    if (guard && !guard(metadata)) {
      if (this.config.debug) {
        reviewLogger.warn(`Guard failed for action ${action} from state ${fromState}`);
      }
      return this.state;
    }
    
    // Perform transition
    this.state = validTransition;
    
    // Record transition
    const transition: StateTransition = {
      from: fromState,
      to: this.state,
      action,
      timestamp: new Date(),
      metadata
    };
    
    this.history.push(transition);
    
    // Notify listener
    if (this.config.onStateChange) {
      this.config.onStateChange(transition);
    }
    
    if (this.config.debug) {
      reviewLogger.info(`State transition: ${fromState} -> ${this.state} (${action})`);
    }
    
    return this.state;
  }
  
  /**
   * Get current state
   */
  getState(): SessionState {
    return this.state;
  }
  
  /**
   * Check if a transition is valid from current state
   */
  canTransition(action: SessionAction, metadata?: Record<string, any>): boolean {
    const validTransition = !!this.transitions[this.state]?.[action];
    
    if (!validTransition) {
      return false;
    }
    
    // Check guard
    const guard = this.guards[action];
    if (guard && !guard(metadata)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get valid actions from current state
   */
  getValidActions(): SessionAction[] {
    return Object.keys(this.transitions[this.state] || {}) as SessionAction[];
  }
  
  /**
   * Get transition history
   */
  getHistory(): StateTransition[] {
    return [...this.history];
  }
  
  /**
   * Get last transition
   */
  getLastTransition(): StateTransition | null {
    return this.history[this.history.length - 1] || null;
  }
  
  /**
   * Reset state machine
   */
  reset(): void {
    const previousState = this.state;
    this.state = this.config.initialState;
    this.history = [];
    
    if (this.config.onStateChange) {
      this.config.onStateChange({
        from: previousState,
        to: this.state,
        action: SessionAction.RESET,
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Force state (use with caution)
   */
  forceState(state: SessionState): void {
    if (this.config.debug) {
      reviewLogger.warn(`Forcing state transition to ${state}`);
    }
    
    const previousState = this.state;
    this.state = state;
    
    this.history.push({
      from: previousState,
      to: state,
      action: SessionAction.RESET,
      timestamp: new Date(),
      metadata: { forced: true }
    });
  }
  
  /**
   * Check if in a specific state
   */
  isInState(state: SessionState): boolean {
    return this.state === state;
  }
  
  /**
   * Check if in any of the specified states
   */
  isInAnyState(...states: SessionState[]): boolean {
    return states.includes(this.state);
  }
  
  /**
   * Check if session is active (can process items)
   */
  isActive(): boolean {
    return this.state === SessionState.ACTIVE;
  }
  
  /**
   * Check if session is terminal (completed or abandoned)
   */
  isTerminal(): boolean {
    return this.isInAnyState(SessionState.COMPLETED, SessionState.ABANDONED);
  }
  
  /**
   * Check if session can be resumed
   */
  canResume(): boolean {
    return this.state === SessionState.PAUSED;
  }
  
  /**
   * Get state metadata
   */
  getStateMetadata(): Record<string, any> {
    const metadata: Record<string, any> = {
      state: this.state,
      isActive: this.isActive(),
      isTerminal: this.isTerminal(),
      canResume: this.canResume(),
      validActions: this.getValidActions(),
      transitionCount: this.history.length
    };
    
    // Add time in current state
    const lastTransition = this.getLastTransition();
    if (lastTransition) {
      metadata.timeInState = Date.now() - lastTransition.timestamp.getTime();
    }
    
    return metadata;
  }
  
  /**
   * Handle invalid transition attempt
   */
  private handleInvalidTransition(from: SessionState, action: SessionAction): void {
    if (this.config.debug) {
      reviewLogger.error(`Invalid transition: ${action} from state ${from}`);
    }
    
    if (this.config.onInvalidTransition) {
      this.config.onInvalidTransition(from, action);
    }
  }
}

/**
 * Helper to create a state machine with common configuration
 */
export function createSessionStateMachine(
  onStateChange?: (transition: StateTransition) => void,
  debug = false
): SessionStateMachine {
  return new SessionStateMachine({
    initialState: SessionState.IDLE,
    onStateChange,
    debug,
    onInvalidTransition: (from, action) => {
      reviewLogger.warn(`Invalid state transition attempted: ${action} from ${from}`);
    }
  });
}

/**
 * State utilities
 */
export const StateUtils = {
  /**
   * Check if state allows user interaction
   */
  isInteractive(state: SessionState): boolean {
    return state === SessionState.ACTIVE;
  },
  
  /**
   * Check if state is transitional (temporary)
   */
  isTransitional(state: SessionState): boolean {
    return [SessionState.STARTING, SessionState.COMPLETING].includes(state);
  },
  
  /**
   * Check if state indicates an error condition
   */
  isError(state: SessionState): boolean {
    return state === SessionState.ERROR;
  },
  
  /**
   * Get display name for state
   */
  getDisplayName(state: SessionState): string {
    const names: Record<SessionState, string> = {
      [SessionState.IDLE]: 'Ready',
      [SessionState.STARTING]: 'Starting...',
      [SessionState.ACTIVE]: 'In Progress',
      [SessionState.PAUSED]: 'Paused',
      [SessionState.COMPLETING]: 'Completing...',
      [SessionState.COMPLETED]: 'Completed',
      [SessionState.ABANDONED]: 'Abandoned',
      [SessionState.ERROR]: 'Error'
    };
    
    return names[state] || state;
  },
  
  /**
   * Get color/theme for state (for UI)
   */
  getStateColor(state: SessionState): string {
    const colors: Record<SessionState, string> = {
      [SessionState.IDLE]: 'gray',
      [SessionState.STARTING]: 'blue',
      [SessionState.ACTIVE]: 'green',
      [SessionState.PAUSED]: 'yellow',
      [SessionState.COMPLETING]: 'blue',
      [SessionState.COMPLETED]: 'green',
      [SessionState.ABANDONED]: 'orange',
      [SessionState.ERROR]: 'red'
    };
    
    return colors[state] || 'gray';
  }
};

/**
 * Export everything for convenience
 */
export default {
  SessionState,
  SessionAction,
  SessionStateMachine,
  createSessionStateMachine,
  StateUtils
};