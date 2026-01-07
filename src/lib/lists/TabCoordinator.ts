/**
 * TabCoordinator - Cross-Tab Communication and Leader Election
 *
 * Manages coordination between multiple browser tabs for the MyLists feature.
 * Prevents data conflicts, duplicate sync operations, and provides real-time
 * synchronization of list changes across all open tabs.
 *
 * Architecture:
 * - Uses BroadcastChannel API for efficient cross-tab messaging
 * - Implements heartbeat-based leader election (5s interval, 10s timeout)
 * - Falls back to localStorage events for older browsers
 * - Leader tab handles sync queue processing (prevents duplicate API calls)
 * - Follower tabs update UI reactively based on leader's changes
 *
 * @example
 * ```typescript
 * const coordinator = new TabCoordinator('lists-coordination')
 * await coordinator.initialize()
 *
 * // Listen for cross-tab messages
 * coordinator.onMessage((message) => {
 *   if (message.type === 'list-created') {
 *     refreshListUI()
 *   }
 * })
 *
 * // Broadcast changes to other tabs
 * coordinator.broadcast({
 *   type: 'list-created',
 *   tabId: coordinator.getTabId(),
 *   timestamp: Date.now(),
 *   data: { listId: '123' }
 * })
 * ```
 */

/**
 * Message structure for cross-tab communication
 */
export interface TabMessage {
  type: 'list-created' | 'list-updated' | 'list-deleted' |
        'item-added' | 'item-removed' | 'sync-request' |
        'leader-election' | 'heartbeat' | 'state-sync' |
        'tab-join' | 'leader-elected' | 'leader-resignation'
  tabId: string
  timestamp: number
  data: any
  requiresResponse?: boolean
}

export class TabCoordinator {
  // Channel for cross-tab communication
  private channel: BroadcastChannel | null = null

  // Unique identifier for this tab (format: tab-{timestamp}-{random})
  private tabId: string

  // Leadership state
  private isLeaderFlag: boolean = false

  // Heartbeat and monitoring timers
  private heartbeatInterval: NodeJS.Timeout | null = null
  private leaderTimeoutCheck: NodeJS.Timeout | null = null
  private electionTimeout: NodeJS.Timeout | null = null
  private resignationElectionTimeout: NodeJS.Timeout | null = null

  // Timestamp of last received heartbeat from leader
  private lastLeaderHeartbeat: number = 0

  // Message handlers registered by consumers
  private messageCallback: ((msg: TabMessage) => void) | null = null

  // Fallback mode flag (for browsers without BroadcastChannel)
  private useFallback: boolean = false

  // Constants for timing
  private readonly HEARTBEAT_INTERVAL = 5000  // 5 seconds - leader sends "I'm alive"
  private readonly LEADER_TIMEOUT = 10000     // 10 seconds - detect leader failure (2 missed beats)
  private readonly ELECTION_DELAY = 100       // 100ms - prevent race conditions during election

  /**
   * Creates a new TabCoordinator instance
   * @param channelName - Unique name for the BroadcastChannel (e.g., 'lists-coordination')
   */
  constructor(private channelName: string) {
    this.tabId = this.generateTabId()
  }

  /**
   * Generates a unique ID for this tab
   * Format: tab-{timestamp}-{random} allows timestamp-based leader election
   * @returns Unique tab identifier
   */
  private generateTabId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }

  /**
   * Initialize the coordinator and join the tab network
   * Must be called before using other methods
   */
  async initialize(): Promise<void> {
    // Check if BroadcastChannel is supported
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('[TabCoordinator] BroadcastChannel not supported, using localStorage fallback')
      this.useFallback = true
      this.initializeFallback()
      return
    }

    // Create BroadcastChannel for this session
    this.channel = new BroadcastChannel(this.channelName)

    // Handle incoming messages from other tabs
    this.channel.onmessage = (event) => {
      this.handleMessage(event.data)
    }

    // Announce presence to other tabs
    this.broadcast({
      type: 'tab-join',
      tabId: this.tabId,
      timestamp: Date.now(),
      data: { tabId: this.tabId }
    })

    // Start leader election process
    await this.electLeader()

    // Setup cleanup on tab close
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.destroy())
    }
  }

  /**
   * Elect a leader tab using timestamp-based algorithm
   * The tab with the oldest timestamp (created first) becomes leader
   */
  private async electLeader(): Promise<void> {
    // Record when we started the election process
    const electionStartTime = Date.now()

    // Wait briefly to collect announcements from existing tabs
    // This prevents race conditions where multiple tabs try to become leader
    await new Promise(resolve => setTimeout(resolve, this.ELECTION_DELAY))

    // Broadcast election message to announce our presence
    const electionMessage: TabMessage = {
      type: 'leader-election',
      tabId: this.tabId,
      timestamp: Date.now(),
      data: null
    }

    this.broadcast(electionMessage)

    // Wait for any existing leader to respond with heartbeat
    // If we receive a heartbeat, we'll become follower instead
    this.electionTimeout = setTimeout(() => {
      // Check if we received a heartbeat since starting election
      const receivedHeartbeatDuringElection = this.lastLeaderHeartbeat > electionStartTime

      // If we received a heartbeat from another leader, don't become leader
      if (receivedHeartbeatDuringElection) {
        console.log(`[TabCoordinator] Tab ${this.tabId} detected existing leader, becoming follower`)
        // Become follower explicitly
        this.becomeFollower()
        // Clear the election timeout reference
        this.electionTimeout = null
        return
      }

      // No heartbeat received, become leader if not already
      if (!this.isLeaderFlag) {
        this.becomeLeader()
      }

      // Clear the election timeout reference
      this.electionTimeout = null
    }, this.ELECTION_DELAY)
  }

  /**
   * Promote this tab to leader role
   * Leaders are responsible for processing sync queue and coordinating operations
   */
  private becomeLeader(): void {
    this.isLeaderFlag = true
    // Don't update lastLeaderHeartbeat here - that's only for heartbeats from OTHER tabs

    console.log(`[TabCoordinator] Tab ${this.tabId} became leader`)

    // Start sending heartbeats to prove we're alive
    this.startHeartbeat()

    // Announce leadership to other tabs
    this.broadcast({
      type: 'leader-elected',
      tabId: this.tabId,
      timestamp: Date.now(),
      data: { tabId: this.tabId }
    })
  }

  /**
   * Demote this tab to follower role
   * Followers listen for changes and update UI reactively
   */
  private becomeFollower(): void {
    console.log(`[TabCoordinator] Tab ${this.tabId} became follower`)

    this.isLeaderFlag = false

    // Stop sending heartbeats
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // Start monitoring leader for timeout
    this.startLeaderTimeoutCheck()
  }

  /**
   * Start sending periodic heartbeats as leader
   * Heartbeats prove leadership is active and prevent re-election
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    // Send initial heartbeat immediately
    this.broadcast({
      type: 'heartbeat',
      tabId: this.tabId,
      timestamp: Date.now(),
      data: null
    })

    // Send heartbeat every 5 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.isLeaderFlag) {
        this.broadcast({
          type: 'heartbeat',
          tabId: this.tabId,
          timestamp: Date.now(),
          data: null
        })
      }
    }, this.HEARTBEAT_INTERVAL)

    // Also start checking for leader timeout (as backup)
    this.startLeaderTimeoutCheck()
  }

  /**
   * Monitor leader heartbeat and trigger re-election if timeout
   * If no heartbeat received for 10 seconds, assume leader died
   */
  private startLeaderTimeoutCheck(): void {
    if (this.leaderTimeoutCheck) {
      clearInterval(this.leaderTimeoutCheck)
    }

    // Check for leader timeout every 2 seconds
    this.leaderTimeoutCheck = setInterval(() => {
      // Only followers check for timeout
      if (!this.isLeaderFlag) {
        const timeSinceLastHeartbeat = Date.now() - this.lastLeaderHeartbeat

        if (timeSinceLastHeartbeat > this.LEADER_TIMEOUT) {
          console.warn('[TabCoordinator] Leader timeout detected, starting new election')
          this.becomeLeader()
        }
      }
    }, 2000)
  }

  /**
   * Handle incoming messages from other tabs
   * @param message - Message received from BroadcastChannel
   */
  private handleMessage(message: TabMessage): void {
    // Ignore messages from self (shouldn't happen with BroadcastChannel, but safety check)
    if (message.tabId === this.tabId) {
      return
    }

    // Pass ALL messages to callback first (including protocol messages)
    // This allows tests and monitoring to observe all cross-tab communication
    if (this.messageCallback) {
      try {
        this.messageCallback(message)
      } catch (error) {
        console.error('[TabCoordinator] Error in message callback:', error)
      }
    }

    // Handle leadership protocol messages
    switch (message.type) {
      case 'leader-election':
        // Another tab is requesting leadership
        // Compare timestamps to determine who should be leader
        this.handleLeaderElection(message)
        break

      case 'heartbeat':
        // Leader is proving they're still alive
        this.handleHeartbeat(message)
        break

      case 'tab-join':
        // New tab joined the network
        this.handleTabJoin(message)
        break

      case 'leader-elected':
        // Another tab became leader
        this.handleLeaderElected(message)
        break

      case 'leader-resignation':
        // Leader is stepping down gracefully
        this.handleLeaderResignation(message)
        break
    }
  }

  /**
   * Handle leader election request from another tab
   * Use timestamp to determine who should be leader (oldest wins)
   */
  private handleLeaderElection(message: TabMessage): void {
    // Extract timestamps from tab IDs
    const ourTimestamp = parseInt(this.tabId.split('-')[1])
    const theirTimestamp = parseInt(message.tabId.split('-')[1])

    // If we're leader and we're older, send heartbeat to assert leadership
    if (this.isLeaderFlag && ourTimestamp < theirTimestamp) {
      // Send immediate heartbeat to prevent the new tab from becoming leader
      this.broadcast({
        type: 'heartbeat',
        tabId: this.tabId,
        timestamp: Date.now(),
        data: null
      })
    }
    // If their tab is older and we're leader, yield leadership
    else if (theirTimestamp < ourTimestamp) {
      if (this.isLeaderFlag) {
        console.log('[TabCoordinator] Yielding leadership to older tab')
        this.becomeFollower()
      }
    }
  }

  /**
   * Handle heartbeat from leader tab
   * Updates last known heartbeat time and checks for split-brain
   */
  private handleHeartbeat(message: TabMessage): void {
    // Update last known heartbeat time
    this.lastLeaderHeartbeat = message.timestamp

    // If we think we're leader but received heartbeat from another leader
    // This is a split-brain scenario - resolve by timestamp
    if (this.isLeaderFlag && message.type === 'heartbeat') {
      const ourTimestamp = parseInt(this.tabId.split('-')[1])
      const theirTimestamp = parseInt(message.tabId.split('-')[1])

      if (theirTimestamp < ourTimestamp) {
        console.log('[TabCoordinator] Stepping down, older leader detected (split-brain resolution)')
        this.becomeFollower()
      }
    } else if (!this.isLeaderFlag) {
      // If we're not leader and received heartbeat, ensure we're in follower mode
      // This helps new tabs recognize existing leaders quickly
      if (!this.leaderTimeoutCheck) {
        this.startLeaderTimeoutCheck()
      }
    }
  }

  /**
   * Handle new tab joining the network
   * If we're leader, send heartbeat immediately to announce leadership
   */
  private handleTabJoin(message: TabMessage): void {
    if (this.isLeaderFlag) {
      // Send heartbeat immediately to prevent new tab from becoming leader
      // Small delay ensures the new tab has set up its message handlers
      setTimeout(() => {
        this.broadcast({
          type: 'heartbeat',
          tabId: this.tabId,
          timestamp: Date.now(),
          data: null
        })
      }, 10)
    }
  }

  /**
   * Handle leader election announcement
   * If we're not the new leader, become follower
   */
  private handleLeaderElected(message: TabMessage): void {
    if (message.tabId !== this.tabId && this.isLeaderFlag) {
      // Another tab became leader, check if they should be
      const ourTimestamp = parseInt(this.tabId.split('-')[1])
      const theirTimestamp = parseInt(message.tabId.split('-')[1])

      if (theirTimestamp < ourTimestamp) {
        console.log('[TabCoordinator] Accepting older tab as leader')
        this.becomeFollower()
      }
    }
  }

  /**
   * Handle leader resignation
   * Start election to choose new leader
   */
  private handleLeaderResignation(message: TabMessage): void {
    if (!this.isLeaderFlag) {
      console.log('[TabCoordinator] Leader resigned, starting election')
      // Small delay to prevent race conditions
      // Track this timeout so it can be cancelled during cleanup
      this.resignationElectionTimeout = setTimeout(() => {
        this.electLeader()
        this.resignationElectionTimeout = null
      }, this.ELECTION_DELAY)
    }
  }

  /**
   * Initialize fallback mode using localStorage events
   * Used when BroadcastChannel is not supported (Safari < 15.4, IE 11)
   */
  private initializeFallback(): void {
    console.log('[TabCoordinator] Initializing localStorage fallback mode')

    // Use storage events as fallback
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key?.startsWith(`${this.channelName}:`)) {
          try {
            const message = JSON.parse(event.newValue || '{}')
            this.handleMessage(message)
          } catch (error) {
            console.error('[TabCoordinator] Failed to parse localStorage message:', error)
          }
        }
      })
    }

    // In fallback mode, assume we're the only tab
    // (localStorage events are unreliable for coordination)
    this.isLeaderFlag = true
    console.log('[TabCoordinator] Fallback mode: assuming leader role')
  }

  /**
   * Broadcast message to all other tabs
   * @param message - Message to broadcast
   */
  broadcast(message: TabMessage): void {
    if (this.useFallback) {
      this.broadcastFallback(message)
    } else if (this.channel) {
      try {
        this.channel.postMessage(message)
      } catch (error) {
        console.error('[TabCoordinator] Failed to broadcast message:', error)
      }
    }
  }

  /**
   * Broadcast message using localStorage fallback
   * @param message - Message to broadcast
   */
  private broadcastFallback(message: TabMessage): void {
    // Create unique key with timestamp to avoid collisions
    const key = `${this.channelName}:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    try {
      localStorage.setItem(key, JSON.stringify(message))

      // Clean up after 1 second to prevent localStorage bloat
      setTimeout(() => {
        try {
          localStorage.removeItem(key)
        } catch (error) {
          // Ignore cleanup errors
        }
      }, 1000)
    } catch (error) {
      console.error('[TabCoordinator] Failed to broadcast via fallback:', error)
    }
  }

  /**
   * Register a callback for cross-tab messages
   * @param callback - Function to call when messages are received
   * @returns Unsubscribe function
   */
  onMessage(callback: (msg: TabMessage) => void): () => void {
    this.messageCallback = callback
    return () => {
      this.messageCallback = null
    }
  }

  /**
   * Check if this tab is currently the leader
   * @returns true if leader, false if follower
   */
  isLeader(): boolean {
    return this.isLeaderFlag
  }

  /**
   * Get this tab's unique identifier
   * @returns Tab ID (format: tab-{timestamp}-{random})
   */
  getTabId(): string {
    return this.tabId
  }

  /**
   * Clean up resources and gracefully shut down
   * Should be called when component unmounts or tab closes
   */
  destroy(): void {
    console.log(`[TabCoordinator] Tab ${this.tabId} shutting down`)

    // If we're leader, announce resignation
    if (this.isLeaderFlag) {
      this.broadcast({
        type: 'leader-resignation',
        tabId: this.tabId,
        timestamp: Date.now(),
        data: { tabId: this.tabId }
      })
    }

    // Clear all timers
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.leaderTimeoutCheck) {
      clearInterval(this.leaderTimeoutCheck)
      this.leaderTimeoutCheck = null
    }

    if (this.electionTimeout) {
      clearTimeout(this.electionTimeout)
      this.electionTimeout = null
    }

    if (this.resignationElectionTimeout) {
      clearTimeout(this.resignationElectionTimeout)
      this.resignationElectionTimeout = null
    }

    // Close BroadcastChannel
    if (this.channel) {
      this.channel.close()
      this.channel = null
    }

    // Clear callback
    this.messageCallback = null
  }
}
