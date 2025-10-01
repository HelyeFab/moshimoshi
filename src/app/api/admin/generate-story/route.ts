import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth/session';
import { JLPTLevel } from '@/types/aiStory';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase/admin';
import { AIService } from '@/lib/ai/AIService';
import { MultiStepStoryRequest } from '@/lib/ai/processors/MultiStepStoryProcessor';

// Initialize Firebase Admin
initAdmin();
const db = getFirestore();

// Initialize AI Service
const aiService = AIService.getInstance();

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const isAdminUser = await isAdmin();
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { step, theme, jlptLevel, pageCount, ...stepData } = body;

    // Step 1: Generate Character Sheet
    if (step === 'character_sheet') {
      // Prepare request for AI service
      const aiRequest: MultiStepStoryRequest = {
        step: 'character_sheet',
        theme,
        jlptLevel,
        pageCount
      };

      // Call unified AI service
      const response = await aiService.process({
        task: 'generate_story_multistep',
        content: aiRequest,
        config: { jlptLevel },
        metadata: {
          source: 'admin-story-generator',
          userId: session.uid,
          step: 'character_sheet'
        }
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate character sheet');
      }

      // Save to Firestore for later steps
      const draftId = `draft_${Date.now()}_${session.uid}`;
      await db.collection('ai_story_drafts').doc(draftId).set({
        characterSheet: response.data,
        theme,
        jlptLevel,
        pageCount,
        userId: session.uid,
        createdAt: new Date(),
        status: 'character_created'
      });

      return NextResponse.json({
        success: true,
        draftId,
        data: response.data,
        usage: response.usage,
        cached: response.cached
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

      // Prepare request for AI service
      const aiRequest: MultiStepStoryRequest = {
        step: 'outline',
        theme,
        jlptLevel,
        pageCount,
        characterSheet,
        draftId
      };

      // Call unified AI service
      const response = await aiService.process({
        task: 'generate_story_multistep',
        content: aiRequest,
        config: { jlptLevel },
        metadata: {
          source: 'admin-story-generator',
          userId: session.uid,
          step: 'outline',
          draftId
        }
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate outline');
      }

      // Update draft in Firestore
      await db.collection('ai_story_drafts').doc(draftId).update({
        outline: response.data,
        status: 'outline_created',
        updatedAt: new Date()
      });

      return NextResponse.json({
        success: true,
        draftId,
        data: response.data,
        usage: response.usage,
        cached: response.cached
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

      // Prepare request for AI service
      const aiRequest: MultiStepStoryRequest = {
        step: 'generate_page',
        jlptLevel,
        pageNumber,
        characterSheet,
        outline,
        draftId
      };

      // Call unified AI service
      const response = await aiService.process({
        task: 'generate_story_multistep',
        content: aiRequest,
        config: { jlptLevel },
        metadata: {
          source: 'admin-story-generator',
          userId: session.uid,
          step: 'generate_page',
          draftId,
          pageNumber
        }
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate page');
      }

      // Update draft with the new page
      const pages = draft?.pages || [];
      pages[pageNumber - 1] = response.data;

      await db.collection('ai_story_drafts').doc(draftId).update({
        pages,
        [`pageStatus.${pageNumber}`]: 'generated',
        updatedAt: new Date()
      });

      return NextResponse.json({
        success: true,
        draftId,
        data: response.data,
        usage: response.usage,
        cached: response.cached
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

      // Prepare request for AI service
      const aiRequest: MultiStepStoryRequest = {
        step: 'generate_quiz',
        jlptLevel,
        pages,
        outline,
        draftId
      };

      // Call unified AI service
      const response = await aiService.process({
        task: 'generate_story_multistep',
        content: aiRequest,
        config: { jlptLevel },
        metadata: {
          source: 'admin-story-generator',
          userId: session.uid,
          step: 'generate_quiz',
          draftId
        }
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate quiz');
      }

      // Update draft with quiz
      await db.collection('ai_story_drafts').doc(draftId).update({
        quiz: response.data,
        status: 'complete',
        updatedAt: new Date()
      });

      return NextResponse.json({
        success: true,
        draftId,
        data: response.data,
        usage: response.usage,
        cached: response.cached
      });
    }

    // Step 5: Generate Character Model Sheet
    if (step === 'generate_model_sheet') {
      const { draftId } = stepData;

      const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get();
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      }

      const draft = draftDoc.data();
      const { characterSheet } = draft as any;

      // Generate model sheet prompt
      const aiRequest: MultiStepStoryRequest = {
        step: 'generate_model_sheet',
        characterSheet,
        draftId
      };

      const response = await aiService.process({
        task: 'generate_story_multistep',
        content: aiRequest,
        metadata: {
          source: 'admin-story-generator',
          userId: session.uid,
          step: 'generate_model_sheet',
          draftId
        }
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate model sheet prompt');
      }

      const { prompt, characterId } = response.data;

      // Generate the actual image using ImageProcessor
      const imageResponse = await aiService.process({
        task: 'generate_character_model_sheet',
        content: {
          character: characterSheet.mainCharacter,
          visualStyle: characterSheet.visualStyle
        },
        metadata: {
          userId: session.uid,
          draftId
        }
      });

      if (!imageResponse.success || !imageResponse.data) {
        throw new Error(imageResponse.error || 'Failed to generate model sheet image');
      }

      const { imageUrl, characterProfile, sessionId } = imageResponse.data;

      // Store image in Firebase Storage
      const storagePath = `stories/${draftId}/model-sheet-${Date.now()}.jpg`;
      const storageResponse = await aiService.process({
        task: 'store_image',
        content: {
          imageUrl,
          storagePath,
          metadata: {
            storyId: draftId,
            type: 'model_sheet',
            characterId
          }
        }
      });

      if (!storageResponse.success) {
        console.error('Failed to store model sheet:', storageResponse.error);
        // Continue anyway with temporary URL
      }

      const finalImageUrl = storageResponse.data?.url || imageUrl;

      // Update draft with model sheet info
      await db.collection('ai_story_drafts').doc(draftId).update({
        modelSheet: {
          imageUrl: finalImageUrl,
          prompt,
          characterProfile,
          sessionId,
          characterId
        },
        characterProfile,
        sessionId,
        updatedAt: new Date()
      });

      return NextResponse.json({
        success: true,
        draftId,
        data: {
          imageUrl: finalImageUrl,
          characterProfile,
          sessionId,
          characterId
        },
        usage: {
          ...response.usage,
          imageCost: imageResponse.usage?.estimatedCost || 0
        }
      });
    }

    // Step 6: Generate Page Image
    if (step === 'generate_page_image') {
      const { draftId, pageNumber } = stepData;

      const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get();
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      }

      const draft = draftDoc.data();
      const { pages, characterSheet, characterProfile, sessionId } = draft as any;
      const page = pages?.[pageNumber - 1];

      if (!page) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404 });
      }

      // Generate enhanced image prompt
      const aiRequest: MultiStepStoryRequest = {
        step: 'generate_page_image',
        pageNumber,
        pageText: page.text,
        pageTranslation: page.translation,
        characterSheet,
        characterProfile,
        sessionId,
        draftId
      };

      const response = await aiService.process({
        task: 'generate_story_multistep',
        content: aiRequest,
        metadata: {
          source: 'admin-story-generator',
          userId: session.uid,
          step: 'generate_page_image',
          draftId,
          pageNumber
        }
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate image prompt');
      }

      const { imagePrompt } = response.data;

      // Generate the actual image
      const imageResponse = await aiService.process({
        task: 'generate_image',
        content: {
          prompt: imagePrompt,
          characterProfile,
          sessionId,
          size: '1024x1024',
          quality: 'standard',
          style: 'vivid'
        },
        metadata: {
          userId: session.uid,
          draftId,
          pageNumber
        }
      });

      if (!imageResponse.success || !imageResponse.data) {
        throw new Error(imageResponse.error || 'Failed to generate page image');
      }

      const { imageUrl, revisedPrompt } = imageResponse.data;

      // Store image in Firebase Storage
      const storagePath = `stories/${draftId}/pages/page-${pageNumber}-${Date.now()}.jpg`;
      const storageResponse = await aiService.process({
        task: 'store_image',
        content: {
          imageUrl,
          storagePath,
          metadata: {
            storyId: draftId,
            pageNumber,
            type: 'page_image'
          }
        }
      });

      if (!storageResponse.success) {
        console.error('Failed to store page image:', storageResponse.error);
        // Continue with temporary URL
      }

      const finalImageUrl = storageResponse.data?.url || imageUrl;

      // Update page with image
      pages[pageNumber - 1] = {
        ...page,
        imageUrl: finalImageUrl,
        imagePrompt,
        revisedPrompt
      };

      await db.collection('ai_story_drafts').doc(draftId).update({
        pages,
        [`pageStatus.${pageNumber}`]: 'image_generated',
        updatedAt: new Date()
      });

      return NextResponse.json({
        success: true,
        draftId,
        data: {
          imageUrl: finalImageUrl,
          imagePrompt,
          revisedPrompt,
          pageNumber
        },
        usage: {
          ...response.usage,
          imageCost: imageResponse.usage?.estimatedCost || 0
        }
      });
    }

    return NextResponse.json({
      error: 'Invalid step parameter. Valid steps: character_sheet, outline, generate_page, generate_quiz, generate_model_sheet, generate_page_image'
    }, { status: 400 });

  } catch (error) {
    console.error('Story generation error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to generate story content',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}