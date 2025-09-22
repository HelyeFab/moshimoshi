
● How to Enable Logs - Step by Step Guide

  Method 1: Enable Logs in Browser Console (Easiest)

  1. Open your browser's Developer Console
    - Chrome/Edge: Press F12 or Ctrl+Shift+I (Windows) / Cmd+Option+I (Mac)
    - Firefox: Press F12 or Ctrl+Shift+K (Windows) / Cmd+Option+K (Mac)
    - Safari: Press Cmd+Option+C (must enable Developer menu first)
  2. Type one of these commands in the console and press Enter:

  // Enable ONLY streak logs
  localStorage.debug = 'app:streak'

  // Enable ONLY pokemon logs  
  localStorage.debug = 'app:pokemon'

  // Enable MULTIPLE specific logs
  localStorage.debug = 'app:streak,app:pokemon,app:achievement'

  // Enable ALL logs (everything)
  localStorage.debug = 'app:*'
  3. Refresh the page (Press F5 or Ctrl+R / Cmd+R)
  4. Now you'll see the logs appearing in the console!

  Method 2: Using the Logger Helper (Even Easier)

  1. Open Developer Console (F12)
  2. Type this command:
  logger.enable('app:*')  // Enables all logs
  2. OR
  logger.enable('app:streak')  // Enables just streak logs
  3. Check what's enabled:
  logger.status()

  To Disable Logs:

  1. Open Developer Console
  2. Type one of these:
  localStorage.debug = ''  // Disables all logs
  2. OR
  logger.disable()  // Also disables all logs
  3. Refresh the page

  📝 Available Log Categories:

  | Command                                | What it shows                 |
  |----------------------------------------|-------------------------------|
  | localStorage.debug = 'app:streak'      | Streak tracking logs          |
  | localStorage.debug = 'app:pokemon'     | Pokemon catching/storage logs |
  | localStorage.debug = 'app:achievement' | Achievement system logs       |
  | localStorage.debug = 'app:auth'        | Authentication/login logs     |
  | localStorage.debug = 'app:review'      | Review engine logs            |
  | localStorage.debug = 'app:sync'        | Data sync logs                |
  | localStorage.debug = 'app:kanji'       | Kanji feature logs            |
  | localStorage.debug = 'app:kana'        | Kana feature logs             |
  | localStorage.debug = 'app:api'         | API call logs                 |
  | localStorage.debug = 'app:db'          | Database operation logs       |
  | localStorage.debug = 'app:*'           | ALL logs                      |

  🎯 Real Example:

  Let's say you want to debug why your streak isn't updating:

  1. Press F12 to open console
  2. Type: localStorage.debug = 'app:streak'
  3. Press Enter
  4. Refresh the page (F5)
  5. Now complete a review session
  6. You'll see logs like:
  2025-09-19T08:15:23.456Z app:streak Recording activity {activity: 'review_session', today: '2025-09-19'}
  2025-09-19T08:15:23.457Z app:streak Streak updated {current: 5, longest: 10}

  🔍 Pro Tips:

  - Multiple categories: Use comma-separated values: localStorage.debug = 'app:streak,app:achievement'
  - Wildcard matching: Use app:* to see everything
  - Persistent: Settings survive page refreshes (until you clear them)
  - Check current setting: Type localStorage.debug to see what's enabled

  That's it! The logs are now under your control - only visible when you want them! 🎉