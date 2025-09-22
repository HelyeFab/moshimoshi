#!/usr/bin/env node

/**
 * Verification script to ensure proper logger usage across the codebase
 * This script can be run periodically to ensure no console statements sneak back in
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function verifyLoggerUsage() {
  console.log('🔍 Verifying logger usage across the project...\n');
  
  try {
    // Check for console statements in review-engine (excluding tests and intentional usage)
    const { stdout: reviewEngineConsole } = await execAsync(
      `grep -r "console\\." src/lib/review-engine --include="*.ts" --exclude="*.test.ts" --exclude="*.bench.ts" | grep -v "// Using console" | grep -v "console.table" || echo "NONE"`
    );
    
    // Count reviewLogger usage
    const { stdout: loggerUsage } = await execAsync(
      `grep -r "reviewLogger\\." src/lib/review-engine --include="*.ts" | wc -l`
    );
    
    // Check for missing logger imports where reviewLogger is used  
    const { stdout: missingImports } = await execAsync(
      `find src/lib/review-engine -name "*.ts" -print0 | xargs -0 -I {} bash -c 'if grep -q "reviewLogger\\." "{}" && ! grep -q "import.*reviewLogger" "{}"; then echo "{}"; fi' 2>/dev/null || echo ""`
    );
    
    console.log('📊 Results:');
    console.log('─'.repeat(50));
    
    // Console statements check
    if (reviewEngineConsole.trim() === 'NONE') {
      console.log('✅ Console statements: Clean (no console.log/error found in review-engine)');
    } else {
      console.log('❌ Console statements found in review-engine:');
      console.log(reviewEngineConsole);
    }
    
    // Logger usage count
    const loggerCount = loggerUsage.trim();
    console.log(`✅ ReviewLogger usage: ${loggerCount} instances`);
    
    // Missing imports check
    if (missingImports.trim() === '' || missingImports.trim() === 'NONE') {
      console.log('✅ Logger imports: All files using reviewLogger have proper imports');
    } else {
      console.log('❌ Missing logger imports in files:');
      console.log(missingImports);
    }
    
    // Log levels verification
    const { stdout: logLevels } = await execAsync(
      `grep -r "reviewLogger\\." src/lib/review-engine --include="*.ts" | grep -o "reviewLogger\\.[a-z]*" | sort | uniq -c | sort -nr`
    );
    
    console.log('\n📈 Log levels usage breakdown:');
    console.log(logLevels);
    
    console.log('\n' + '─'.repeat(50));
    
    // Overall assessment
    const isClean = reviewEngineConsole.trim() === 'NONE' && (missingImports.trim() === 'NONE' || missingImports.trim() === '');
    if (isClean) {
      console.log('🎉 Overall status: PASS - Logger usage is correct!');
      process.exit(0);
    } else {
      console.log('⚠️  Overall status: FAIL - Issues found that need attention');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Error running verification:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  verifyLoggerUsage();
}

module.exports = verifyLoggerUsage;