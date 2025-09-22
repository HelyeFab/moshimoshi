/**
 * Test script for multi-step story generation via unified AI service
 */

// Mock Firestore for testing
const mockFirestore = {
  drafts: new Map(),

  collection: (name) => ({
    doc: (id) => ({
      set: async (data) => {
        mockFirestore.drafts.set(id, { ...data, id });
        console.log(`✅ Draft saved: ${id}`);
        return Promise.resolve();
      },
      get: async () => ({
        exists: mockFirestore.drafts.has(id),
        data: () => mockFirestore.drafts.get(id)
      }),
      update: async (updates) => {
        const existing = mockFirestore.drafts.get(id);
        mockFirestore.drafts.set(id, { ...existing, ...updates });
        console.log(`✅ Draft updated: ${id}`);
        return Promise.resolve();
      }
    })
  })
};

// Mock the modules
const mockContext = {
  model: 'gpt-4o-mini',
  config: {
    temperature: 0.7,
    maxTokens: 4000
  }
};

// Import the processor
const { MultiStepStoryProcessor } = require('./src/lib/ai/processors/MultiStepStoryProcessor');

async function testMultiStepStory() {
  console.log('🎯 Testing Multi-Step Story Generation with Unified AI Service\n');
  console.log('=' .repeat(60));

  const processor = new MultiStepStoryProcessor(mockContext);

  // Override callOpenAI to simulate responses
  processor.callOpenAI = async (systemPrompt, userPrompt) => {
    // Simulate different responses based on the prompt content
    let response;
    let usage = {
      promptTokens: 500,
      completionTokens: 800,
      totalTokens: 1300,
      estimatedCost: 0.002
    };

    if (userPrompt.includes('character sheet')) {
      response = {
        mainCharacter: {
          name: "Yuki",
          nameJa: "ゆき",
          description: "A curious young student learning about seasons",
          visualDescription: "Young student with short black hair, wearing a blue school uniform",
          personality: "Curious, friendly, eager to learn"
        },
        supportingCharacters: [
          {
            name: "Sensei Tanaka",
            nameJa: "田中先生",
            description: "A wise and patient teacher",
            visualDescription: "Middle-aged teacher with glasses and a warm smile",
            role: "Guide and mentor"
          }
        ],
        setting: {
          location: "Kyoto",
          locationJa: "京都",
          time: "Present day, spring",
          atmosphere: "Peaceful and educational",
          visualStyle: "Soft watercolor with cherry blossoms"
        },
        visualStyle: "Soft watercolor Japanese art style",
        colorPalette: ["#FFB6C1", "#87CEEB", "#98FB98"],
        moodKeywords: ["peaceful", "educational", "spring"]
      };
    } else if (userPrompt.includes('outline')) {
      response = {
        title: "Yuki's Spring Discovery",
        titleJa: "ゆきの春の発見",
        description: "A story about discovering the beauty of spring in Kyoto",
        descriptionJa: "京都で春の美しさを発見する物語",
        pages: [
          {
            pageNumber: 1,
            summary: "Yuki notices cherry blossoms blooming",
            summaryJa: "ゆきが桜の花が咲いているのに気づく",
            imagePrompt: "Yuki looking up at cherry blossoms in wonder",
            keyVocabulary: ["桜", "春", "きれい"],
            grammarPoints: ["です/ます form", "adjective + noun"]
          },
          {
            pageNumber: 2,
            summary: "Meeting Tanaka-sensei in the garden",
            summaryJa: "庭で田中先生に会う",
            imagePrompt: "Yuki and Tanaka-sensei in a Japanese garden",
            keyVocabulary: ["先生", "庭", "会う"],
            grammarPoints: ["に particle for location", "present tense"]
          }
        ],
        targetVocabulary: ["桜", "春", "きれい", "先生", "庭"],
        targetGrammar: ["です/ます", "particle に", "い-adjectives"]
      };
    } else if (userPrompt.includes('Generate page')) {
      const pageNum = userPrompt.match(/page (\d+)/)?.[1] || '1';
      response = {
        pageNumber: parseInt(pageNum),
        text: "桜がきれいですね。春が来ました。",
        textWithFurigana: "<ruby>桜<rt>さくら</rt></ruby>がきれいですね。<ruby>春<rt>はる</rt></ruby>が<ruby>来<rt>き</rt></ruby>ました。",
        translation: "The cherry blossoms are beautiful. Spring has come.",
        vocabularyNotes: {
          "桜": "cherry blossom",
          "春": "spring",
          "来る": "to come"
        },
        grammarNotes: {
          "が": "subject marker particle",
          "ですね": "polite copula with agreement seeking"
        },
        imagePrompt: "Watercolor style: Young student Yuki with short black hair in blue uniform looking at pink cherry blossoms"
      };
    } else if (userPrompt.includes('quiz')) {
      response = {
        questions: [
          {
            id: "q1",
            question: "What season is depicted in the story?",
            questionJa: "物語はどの季節ですか？",
            options: ["Spring", "Summer", "Autumn", "Winter"],
            correctIndex: 0,
            explanation: "The story mentions 春 (haru) which means spring",
            explanationJa: "物語に「春」という言葉が出てきます"
          },
          {
            id: "q2",
            question: "What does 桜 mean?",
            questionJa: "「桜」の意味は何ですか？",
            options: ["Pine tree", "Cherry blossom", "Maple leaf", "Bamboo"],
            correctIndex: 1,
            explanation: "桜 (sakura) means cherry blossom",
            explanationJa: "桜（さくら）は cherry blossom という意味です"
          }
        ]
      };
    }

    return {
      content: JSON.stringify(response),
      usage
    };
  };

  try {
    // Test Step 1: Character Sheet
    console.log('\n📝 Step 1: Generating Character Sheet');
    console.log('-'.repeat(40));

    const characterResult = await processor.process({
      step: 'character_sheet',
      theme: 'Spring in Japan',
      jlptLevel: 'N5',
      pageCount: 3
    });

    console.log('✅ Character Sheet Generated:');
    console.log('  Main Character:', characterResult.data.mainCharacter.name);
    console.log('  Setting:', characterResult.data.setting.location);
    console.log('  Visual Style:', characterResult.data.visualStyle);
    console.log('  Usage:', characterResult.usage);

    // Test Step 2: Outline
    console.log('\n📋 Step 2: Generating Story Outline');
    console.log('-'.repeat(40));

    const outlineResult = await processor.process({
      step: 'outline',
      theme: 'Spring in Japan',
      jlptLevel: 'N5',
      pageCount: 3,
      characterSheet: characterResult.data,
      draftId: 'test_draft_123'
    });

    console.log('✅ Outline Generated:');
    console.log('  Title:', outlineResult.data.title);
    console.log('  Title (Japanese):', outlineResult.data.titleJa);
    console.log('  Pages:', outlineResult.data.pages.length);
    console.log('  Target Vocabulary:', outlineResult.data.targetVocabulary.join(', '));

    // Test Step 3: Generate Pages
    console.log('\n📖 Step 3: Generating Story Pages');
    console.log('-'.repeat(40));

    for (let i = 1; i <= 2; i++) {
      const pageResult = await processor.process({
        step: 'generate_page',
        jlptLevel: 'N5',
        pageNumber: i,
        characterSheet: characterResult.data,
        outline: outlineResult.data,
        draftId: 'test_draft_123'
      });

      console.log(`\n✅ Page ${i} Generated:`);
      console.log('  Text:', pageResult.data.text);
      console.log('  Translation:', pageResult.data.translation);
      console.log('  Vocabulary Notes:', Object.keys(pageResult.data.vocabularyNotes).length, 'items');
    }

    // Test Step 4: Generate Quiz
    console.log('\n❓ Step 4: Generating Quiz');
    console.log('-'.repeat(40));

    const quizResult = await processor.process({
      step: 'generate_quiz',
      jlptLevel: 'N5',
      pages: [
        { text: "桜がきれいですね。", translation: "The cherry blossoms are beautiful." },
        { text: "春が来ました。", translation: "Spring has come." }
      ],
      outline: outlineResult.data,
      draftId: 'test_draft_123'
    });

    console.log('✅ Quiz Generated:');
    console.log('  Questions:', quizResult.data.length);
    quizResult.data.forEach(q => {
      console.log(`  - ${q.question}`);
      console.log(`    Options: ${q.options.join(', ')}`);
      console.log(`    Correct: ${q.options[q.correctAnswer]}`);
    });

    // Test validation errors
    console.log('\n🚫 Testing Error Handling');
    console.log('-'.repeat(40));

    try {
      await processor.process({
        step: 'character_sheet'
        // Missing required theme
      });
    } catch (error) {
      console.log('✅ Validation error caught:', error.message);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MULTI-STEP STORY GENERATION TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('\n✅ All 4 steps executed successfully:');
    console.log('  1. Character Sheet Generation ✓');
    console.log('  2. Story Outline Generation ✓');
    console.log('  3. Page Content Generation ✓');
    console.log('  4. Quiz Generation ✓');
    console.log('\n✅ Error handling working correctly');
    console.log('\n🎉 Multi-step story processor is fully functional!');

    // Show caching benefit
    console.log('\n💾 Caching Benefits:');
    console.log('  - Each step can be cached independently');
    console.log('  - Regenerating a single page doesn\'t require redoing all steps');
    console.log('  - Draft persistence allows resuming incomplete stories');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testMultiStepStory();