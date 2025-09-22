import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAdminRole } from '@/lib/firebase/auth-admin';
import { JLPTLevel } from '@/types/aiStory';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase/admin';

// Initialize Firebase Admin
initAdmin();
const db = getFirestore();

// Content safety guidelines
const CONTENT_GUIDELINES = `
IMPORTANT CONTENT GUIDELINES:
- NO sexual content or innuendo
- NO violence or graphic descriptions
- NO racial, gender, or cultural stereotypes
- NO political or controversial topics
- NO religious content
- Focus on educational, wholesome, and culturally respectful content
- Suitable for all ages
`;

// JLPT level guidelines
const JLPT_GUIDELINES: Record<JLPTLevel, string> = {
  N5: 'Use only basic vocabulary and simple sentence structures. Present tense mainly, very simple past tense. Basic particles (は、が、を、に、で、と、も、の). Maximum 10-15 words per sentence.',
  N4: 'Use elementary vocabulary and grammar. Can use past tense, て-form, basic adjective conjugations. Sentences up to 15-20 words.',
  N3: 'Use intermediate vocabulary and grammar. Can use passive, causative, conditional forms. More complex sentence structures. Sentences up to 20-25 words.',
  N2: 'Use upper-intermediate vocabulary and grammar. Complex sentence patterns, keigo, nuanced expressions. Natural flowing text.',
  N1: 'Use advanced vocabulary and grammar. Literary expressions, complex kanji, sophisticated sentence structures. No restrictions.',
};

export const runtime = 'nodejs';
export const maxDuration = 60;

// Initialize OpenAI client (singleton)
let openaiClient: OpenAI | null = null;
function getOpenAIClient() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
      maxRetries: 2,
    });
  }
  return openaiClient;
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    const authResult = await checkAdminRole(authHeader);
    
    if (!authResult.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Check if OpenAI API key is configured
    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.' 
      }, { status: 500 });
    }

    const body = await request.json();
    const { step, theme, jlptLevel, pageCount, ...stepData } = body;

    // Step 1: Generate Character Sheet
    if (step === 'character_sheet') {
      const characterPrompt = `Create a character sheet for a Japanese learning story with the following requirements:

Theme: ${theme}
JLPT Level: ${jlptLevel}
Story Length: ${pageCount} pages

${CONTENT_GUIDELINES}

Create a detailed character sheet in JSON format with:
1. A main character (with name in English and Japanese)
2. 1-2 supporting characters
3. Setting details (location, time period, atmosphere)
4. Visual style description for consistency

The characters should be:
- Age-appropriate and relatable for language learners
- Culturally authentic but not stereotypical
- Interesting but not overly complex

Response format (JSON only, no markdown):
{
  "mainCharacter": {
    "name": "English name",
    "nameJa": "Japanese name with kanji/kana",
    "description": "Character personality and role",
    "visualDescription": "Physical appearance for image generation",
    "personality": "Key personality traits"
  },
  "supportingCharacters": [
    {
      "name": "English name",
      "nameJa": "Japanese name",
      "description": "Character role",
      "visualDescription": "Physical appearance",
      "role": "Relationship to main character"
    }
  ],
  "setting": {
    "location": "Where the story takes place",
    "locationJa": "Location in Japanese",
    "time": "Time period or season",
    "atmosphere": "Overall mood and feeling",
    "visualStyle": "Art style description"
  },
  "visualStyle": "Overall visual style for all images (e.g., soft watercolor, anime-style, children's book illustration)",
  "colorPalette": ["#hex1", "#hex2", "#hex3"],
  "moodKeywords": ["keyword1", "keyword2", "keyword3"]
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in creating educational Japanese stories for language learners. You understand JLPT levels and create culturally appropriate content.'
          },
          {
            role: 'user',
            content: characterPrompt
          }
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' }
      });

      const characterSheet = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Save to Firestore for later steps
      const draftId = `draft_${Date.now()}_${authResult.userId}`;
      await db.collection('ai_story_drafts').doc(draftId).set({
        characterSheet,
        theme,
        jlptLevel,
        pageCount,
        userId: authResult.userId,
        createdAt: new Date(),
        status: 'character_created'
      });
      
      return NextResponse.json({
        success: true,
        draftId,
        data: characterSheet,
        usage: completion.usage
      });
    }

    // Step 2: Generate Story Outline
    if (step === 'outline') {
      const { draftId } = stepData;
      
      // Retrieve draft from Firestore
      const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get();
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      }
      
      const draft = draftDoc.data();
      const { characterSheet } = draft as any;
      
      const outlinePrompt = `Create a story outline for a Japanese learning story:

Theme: ${theme}
JLPT Level: ${jlptLevel}
Number of pages: ${pageCount}

Character Sheet:
${JSON.stringify(characterSheet, null, 2)}

${CONTENT_GUIDELINES}
${JLPT_GUIDELINES[jlptLevel]}

Create a page-by-page outline that:
1. Tells a complete, engaging story
2. Uses vocabulary and grammar appropriate for ${jlptLevel}
3. Introduces concepts gradually
4. Includes repetition of key vocabulary
5. Has a clear beginning, middle, and end

Response format (JSON only):
{
  "title": "Story title in English",
  "titleJa": "Story title in Japanese",
  "description": "Brief story description",
  "descriptionJa": "Description in Japanese",
  "pages": [
    {
      "pageNumber": 1,
      "summary": "What happens on this page",
      "summaryJa": "Summary in simple Japanese",
      "imagePrompt": "Detailed description for image generation",
      "keyVocabulary": ["word1", "word2"],
      "grammarPoints": ["grammar1", "grammar2"]
    }
  ],
  "targetVocabulary": ["List of main vocabulary words to teach"],
  "targetGrammar": ["List of main grammar points"]
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in creating educational Japanese stories for language learners.'
          },
          {
            role: 'user',
            content: outlinePrompt
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const outline = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Update draft in Firestore
      await db.collection('ai_story_drafts').doc(draftId).update({
        outline,
        status: 'outline_created',
        updatedAt: new Date()
      });
      
      return NextResponse.json({
        success: true,
        draftId,
        data: outline,
        usage: completion.usage
      });
    }

    // Step 3: Generate Story Pages
    if (step === 'generate_page') {
      const { draftId, pageNumber } = stepData;
      
      // Retrieve draft from Firestore
      const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get();
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      }
      
      const draft = draftDoc.data();
      const { characterSheet, outline } = draft as any;
      
      const pagePrompt = `Generate page ${pageNumber} of the Japanese learning story:

Character Sheet:
${JSON.stringify(characterSheet, null, 2)}

Page Outline:
${JSON.stringify(outline.pages[pageNumber - 1], null, 2)}

JLPT Level: ${jlptLevel}
${JLPT_GUIDELINES[jlptLevel]}

Generate the actual story text for this page following these requirements:
1. Japanese text with natural flow
2. Use vocabulary and grammar appropriate for ${jlptLevel}
3. Make it engaging and educational
4. Include the key vocabulary and grammar points from the outline
5. Text should be 3-5 sentences for N5, 4-6 for N4, 5-8 for N3+

Response format (JSON only):
{
  "pageNumber": ${pageNumber},
  "text": "Japanese text for the page (plain text, no furigana)",
  "textWithFurigana": "Same text but with furigana in HTML ruby tags <ruby>漢字<rt>かんじ</rt></ruby>",
  "translation": "Natural English translation",
  "vocabularyNotes": {
    "word1": "explanation",
    "word2": "explanation"
  },
  "grammarNotes": {
    "pattern1": "explanation",
    "pattern2": "explanation"
  },
  "imagePrompt": "Detailed prompt for DALL-E including character descriptions and visual style from character sheet"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in writing Japanese learning materials. You create natural, engaging text appropriate for specific JLPT levels.'
          },
          {
            role: 'user',
            content: pagePrompt
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const pageContent = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Update draft with the new page
      const pages = draft?.pages || [];
      pages[pageNumber - 1] = pageContent;
      
      await db.collection('ai_story_drafts').doc(draftId).update({
        pages,
        [`pageStatus.${pageNumber}`]: 'generated',
        updatedAt: new Date()
      });
      
      return NextResponse.json({
        success: true,
        draftId,
        data: pageContent,
        usage: completion.usage
      });
    }

    // Step 4: Generate Quiz
    if (step === 'generate_quiz') {
      const { draftId } = stepData;
      
      // Retrieve draft from Firestore
      const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get();
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      }
      
      const draft = draftDoc.data();
      const { pages, outline } = draft as any;
      
      const quizPrompt = `Create a comprehension quiz for this Japanese story:

Story Title: ${outline.title} / ${outline.titleJa}
Story Pages: ${JSON.stringify(pages.map((p: any) => ({ text: p.text, translation: p.translation })), null, 2)}

JLPT Level: ${jlptLevel}

Create 5-8 multiple choice questions that test:
1. Reading comprehension
2. Vocabulary understanding
3. Grammar recognition
4. Story sequence
5. Character understanding

Questions should be appropriate for ${jlptLevel} learners.

Response format (JSON only):
{
  "questions": [
    {
      "id": "q1",
      "question": "Question in English",
      "questionJa": "Question in Japanese (optional for higher levels)",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct",
      "explanationJa": "Explanation in Japanese"
    }
  ]
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in creating educational assessments for Japanese language learners.'
          },
          {
            role: 'user',
            content: quizPrompt
          }
        ],
        temperature: 0.6,
        response_format: { type: 'json_object' }
      });

      const quiz = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Update draft with quiz
      await db.collection('ai_story_drafts').doc(draftId).update({
        quiz: quiz.questions,
        status: 'complete',
        updatedAt: new Date()
      });
      
      return NextResponse.json({
        success: true,
        draftId,
        data: quiz,
        usage: completion.usage
      });
    }

    return NextResponse.json({ 
      error: 'Invalid step parameter. Valid steps: character_sheet, outline, generate_page, generate_quiz' 
    }, { status: 400 });

  } catch (error) {
    console.error('Story generation error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate story content',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}