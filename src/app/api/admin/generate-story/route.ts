import { NextRequest, NextResponse } from 'next/server';
import { checkAdminRole } from '@/lib/firebase/auth-admin';
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
    const authHeader = request.headers.get('authorization');
    const authResult = await checkAdminRole(authHeader);

    if (!authResult.isAdmin) {
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
          userId: authResult.userId,
          step: 'character_sheet'
        }
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate character sheet');
      }

      // Save to Firestore for later steps
      const draftId = `draft_${Date.now()}_${authResult.userId}`;
      await db.collection('ai_story_drafts').doc(draftId).set({
        characterSheet: response.data,
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
          userId: authResult.userId,
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
          userId: authResult.userId,
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
          userId: authResult.userId,
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