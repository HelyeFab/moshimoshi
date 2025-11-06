/**
 * Validation script for conjugation help content
 * Ensures all content is properly structured and accessible
 */

import {
  HELP_CONTENT,
  getHelpById,
  getHelpByCategory,
  getHelpByWordType,
  getHelpByFormType,
  getHelpByErrorPattern,
  searchHelp
} from '../src/data/conjugation-help/help-content';

// Color codes for console output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(color: string, message: string) {
  console.log(`${color}${message}${RESET}`);
}

function validateHelpContent() {
  log(YELLOW, '\n🔍 Validating Help Content Structure...\n');

  let errors = 0;
  let warnings = 0;

  // 1. Check that we have content
  if (HELP_CONTENT.length === 0) {
    log(RED, '❌ ERROR: No help content found!');
    errors++;
  } else {
    log(GREEN, `✓ Found ${HELP_CONTENT.length} help items`);
  }

  // 2. Validate each help item
  HELP_CONTENT.forEach((help, index) => {
    const prefix = `[${index + 1}/${HELP_CONTENT.length}] ${help.id}:`;

    // Check required fields
    if (!help.id) {
      log(RED, `${prefix} Missing ID`);
      errors++;
    }

    if (!help.emoji) {
      log(RED, `${prefix} Missing emoji`);
      errors++;
    }

    if (!help.title) {
      log(RED, `${prefix} Missing title`);
      errors++;
    }

    if (!help.tooltip) {
      log(RED, `${prefix} Missing tooltip`);
      errors++;
    }

    if (!help.explanation) {
      log(RED, `${prefix} Missing explanation`);
      errors++;
    }

    if (!help.examples || help.examples.length === 0) {
      log(YELLOW, `${prefix} Warning - No examples provided`);
      warnings++;
    }

    if (!help.triggers.formTypes || help.triggers.formTypes.length === 0) {
      log(YELLOW, `${prefix} Warning - No form types specified`);
      warnings++;
    }

    if (!help.triggers.wordTypes || help.triggers.wordTypes.length === 0) {
      log(YELLOW, `${prefix} Warning - No word types specified`);
      warnings++;
    }

    // Check for duplicate IDs
    const duplicates = HELP_CONTENT.filter(h => h.id === help.id);
    if (duplicates.length > 1) {
      log(RED, `${prefix} Duplicate ID found!`);
      errors++;
    }
  });

  // 3. Test helper functions
  log(YELLOW, '\n🔧 Testing Helper Functions...\n');

  // Test getHelpById
  const ichidanHelp = getHelpById('ichidan-verbs');
  if (ichidanHelp) {
    log(GREEN, '✓ getHelpById() works correctly');
  } else {
    log(RED, '❌ getHelpById() failed to find "ichidan-verbs"');
    errors++;
  }

  // Test getHelpByCategory
  const verbTypes = getHelpByCategory('verb-type');
  if (verbTypes.length > 0) {
    log(GREEN, `✓ getHelpByCategory() found ${verbTypes.length} verb-type items`);
  } else {
    log(RED, '❌ getHelpByCategory() found no verb-type items');
    errors++;
  }

  // Test getHelpByWordType
  const godanHelp = getHelpByWordType('Godan');
  if (godanHelp.length > 0) {
    log(GREEN, `✓ getHelpByWordType() found ${godanHelp.length} Godan items`);
  } else {
    log(RED, '❌ getHelpByWordType() found no Godan items');
    errors++;
  }

  // Test getHelpByFormType
  const pastHelp = getHelpByFormType('past');
  if (pastHelp.length > 0) {
    log(GREEN, `✓ getHelpByFormType() found ${pastHelp.length} past tense items`);
  } else {
    log(RED, '❌ getHelpByFormType() found no past tense items');
    errors++;
  }

  // Test getHelpByErrorPattern
  const errorHelp = getHelpByErrorPattern('いかった');
  if (errorHelp.length > 0) {
    log(GREEN, `✓ getHelpByErrorPattern() found ${errorHelp.length} items for "いかった"`);
  } else {
    log(YELLOW, '⚠ getHelpByErrorPattern() found no items for "いかった"');
    warnings++;
  }

  // Test searchHelp
  const searchResults = searchHelp('verb');
  if (searchResults.length > 0) {
    log(GREEN, `✓ searchHelp() found ${searchResults.length} items for "verb"`);
  } else {
    log(RED, '❌ searchHelp() found no results for "verb"');
    errors++;
  }

  // 4. Category breakdown
  log(YELLOW, '\n📊 Content Breakdown by Category:\n');

  const categories = Array.from(new Set(HELP_CONTENT.map(h => h.category)));
  categories.forEach(category => {
    const count = HELP_CONTENT.filter(h => h.category === category).length;
    log(GREEN, `  ${category}: ${count} items`);
  });

  // 5. Summary
  log(YELLOW, '\n📋 Validation Summary:\n');

  if (errors === 0 && warnings === 0) {
    log(GREEN, '✅ All validations passed! Content structure is perfect.');
  } else {
    if (errors > 0) {
      log(RED, `❌ Found ${errors} error(s)`);
    }
    if (warnings > 0) {
      log(YELLOW, `⚠️  Found ${warnings} warning(s)`);
    }
  }

  return { errors, warnings };
}

// Run validation
const result = validateHelpContent();
process.exit(result.errors > 0 ? 1 : 0);
