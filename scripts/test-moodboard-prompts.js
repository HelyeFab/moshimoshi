#!/usr/bin/env node

/**
 * Test to see what prompts are being generated
 */

require('dotenv').config({ path: '.env.local' });

const { PromptManager } = require('../src/lib/ai/config/PromptManager.ts');

async function testPrompts() {
  console.log('📝 Testing Prompt Generation...\n');

  const promptManager = PromptManager.getInstance();

  const content = {
    theme: 'Family',
    kanjiCount: 10,
    tags: ['beginner', 'common'],
    focusAreas: ['immediate family', 'relationships']
  };

  const config = {
    jlptLevel: 'N5'
  };

  const prompts = promptManager.getPromptsForTask('generate_moodboard', content, config);

  if (prompts) {
    console.log('=== SYSTEM PROMPT ===');
    console.log(prompts.system);
    console.log('\n=== USER PROMPT ===');
    console.log(prompts.user);
  } else {
    console.log('No prompts found');
  }
}

testPrompts();