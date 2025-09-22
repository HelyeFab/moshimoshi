  🎯 Key Ways to Use Your Stored Memories

  1. Quick Context Retrieval

  // When working on review engine features:
  memory_search(query="review engine", project="moshimoshi")
  memory_search(query="SRS algorithm")
  memory_search(query="validation fuzzy")

  2. Architecture Reference

  // Need to remember file locations?
  memory_search(query="line numbers")
  // Returns: interfaces.ts:42, algorithm.ts:156, etc.

  // Need the queue algorithm?
  memory_search(query="prioritization algorithm")

  3. Debug & Troubleshooting

  // Having issues? Find debug commands:
  memory_search(query="debug commands")
  // Returns localStorage debug settings, IndexedDB checks, etc.

  4. Performance Optimization

  // Check performance targets:
  memory_search(query="performance optimization")
  // Returns: SRS <1ms, Queue <100ms, etc.

  5. Cross-Session Development

  When starting a new Claude session:
  // Get project context immediately:
  project_summary(project="moshimoshi")
  // Returns all 16 memories with categories

  // Get related memories for current work:
  memory_suggest_related(context="working on validation system")

  6. Future Feature Planning

  // Check roadmap items:
  memory_search(query="future improvements")
  // Returns handwriting recognition priority, etc.

  🔥 Power User Tips

  Auto-Store New Decisions

  memory_auto_store("Decided to use React Query for data fetching instead of Redux")
  memory_auto_store("Fixed authentication bug by checking Redis TTL before JWT validation")

  Pattern Recognition Across Projects

  // Find similar solutions:
  memory_search(query="authentication")  // Search all projects
  memory_suggest_related(context="implementing OAuth")

  Project Intelligence

  // Generate comprehensive summary:
  memory_summarize_project(project="moshimoshi")

  // Analyze storage efficiency:
  memory_analyze_storage(project="moshimoshi")

  Maintenance & Cleanup

  // Archive old memories:
  memory_suggest_archival(project="moshimoshi", days_threshold=90)
  memory_cleanup(project="moshimoshi", dry_run=true)  // Preview first

  💡 Practical Scenarios

  Starting new feature:
  1. memory_search("review engine architecture") - Get system overview
  2. memory_search("adapter pattern") - Find extension points
  3. memory_auto_store("Adding voice input adapter for pronunciation practice")

  Debugging issue:
  1. memory_search("debug commands") - Get debug tools
  2. memory_search("common issues") - Find known problems
  3. memory_auto_store("Fixed IndexedDB sync by adding retry logic")

  Performance work:
  1. memory_search("performance") - Get current metrics
  2. memory_suggest_related("optimization") - Find techniques
  3. memory_auto_store("Improved queue generation to 50ms with memoization")

  The memories you've stored are now a permanent knowledge base that will persist across all
  Claude sessions, making every future conversation about Moshimoshi instantly context-aware!