/**
 * Entitlements Bridge for Review Engine
 * Integrates the entitlements system with the review engine
 */

import type { ReviewableContent } from '@/lib/review-engine/core/interfaces';
import type { ReviewSession } from '@/lib/review-engine/core/session.types';
import type { FeatureId } from '@/types/FeatureId';
import type { Decision } from '@/types/entitlements';
import { EventEmitter } from 'events';

export class EntitlementsBridge extends EventEmitter {
  /**
   * Maps content types to feature IDs
   */
  private static contentTypeToFeatureId(contentType: string): FeatureId | null {
    const mapping: Record<string, FeatureId> = {
      'hiragana': 'hiragana_practice',
      'katakana': 'katakana_practice',
      'kana-hiragana': 'hiragana_practice',
      'kana-katakana': 'katakana_practice'
    };

    return mapping[contentType.toLowerCase()] || null;
  }

  /**
   * Checks if a review session can start based on entitlements
   */
  static async canStartSession(
    content: ReviewableContent[],
    checkEntitlement: (featureId: FeatureId) => Promise<Decision>
  ): Promise<{ allowed: boolean; decision?: Decision; featureId?: FeatureId }> {
    if (!content || content.length === 0) {
      return { allowed: true }; // No content, no restriction
    }

    // Determine the primary content type
    const primaryContent = content[0];
    const contentType = primaryContent.contentType;
    
    if (!contentType) {
      return { allowed: true }; // Unknown type, allow by default
    }

    const featureId = this.contentTypeToFeatureId(contentType);
    
    if (!featureId) {
      // Content type doesn't require entitlement check
      return { allowed: true };
    }

    // Check entitlement
    const decision = await checkEntitlement(featureId);
    
    return {
      allowed: decision.allow,
      decision,
      featureId
    };
  }

  /**
   * Enhances a review session with entitlement information
   */
  static enhanceSession(session: ReviewSession, decision: Decision, featureId: FeatureId): ReviewSession {
    return {
      ...session,
      metadata: {
        ...session.metadata,
        entitlement: {
          featureId,
          decision,
          checkedAt: new Date().toISOString(),
          remaining: decision.remaining,
          resetAt: decision.resetAtUtc
        }
      }
    };
  }

  /**
   * Creates a blocked session response
   */
  static createBlockedSession(decision: Decision, featureId: FeatureId): Partial<ReviewSession> {
    return {
      id: `blocked-${Date.now()}`,
      status: 'abandoned',
      metadata: {
        entitlement: {
          featureId,
          decision,
          blockedAt: new Date().toISOString(),
          reason: decision.reason,
          resetAt: decision.resetAtUtc
        }
      }
    };
  }

  /**
   * Extracts feature requirements from a queue of content
   */
  static analyzeQueueRequirements(queue: ReviewableContent[]): {
    requiredFeatures: Set<FeatureId>;
    contentByFeature: Map<FeatureId, ReviewableContent[]>;
  } {
    const requiredFeatures = new Set<FeatureId>();
    const contentByFeature = new Map<FeatureId, ReviewableContent[]>();

    for (const content of queue) {
      const contentType = content.contentType;
      if (!contentType) continue;

      const featureId = this.contentTypeToFeatureId(contentType);
      if (!featureId) continue;

      requiredFeatures.add(featureId);
      
      if (!contentByFeature.has(featureId)) {
        contentByFeature.set(featureId, []);
      }
      contentByFeature.get(featureId)!.push(content);
    }

    return { requiredFeatures, contentByFeature };
  }

  /**
   * Filters a queue based on available entitlements
   */
  static async filterQueueByEntitlements(
    queue: ReviewableContent[],
    checkEntitlement: (featureId: FeatureId) => Promise<Decision>
  ): Promise<ReviewableContent[]> {
    const { contentByFeature } = this.analyzeQueueRequirements(queue);
    const allowedContent: ReviewableContent[] = [];

    for (const [featureId, contents] of contentByFeature) {
      const decision = await checkEntitlement(featureId);
      
      if (decision.allow) {
        // If unlimited, add all content
        if (decision.remaining === -1) {
          allowedContent.push(...contents);
        } else {
          // Add only up to the remaining limit
          allowedContent.push(...contents.slice(0, decision.remaining));
        }
      }
    }

    // Add any content that doesn't require entitlements
    for (const content of queue) {
      const contentType = content.contentType;
      if (!contentType || !this.contentTypeToFeatureId(contentType)) {
        allowedContent.push(content);
      }
    }

    return allowedContent;
  }

  /**
   * Generates a usage summary for display
   */
  static generateUsageSummary(decisions: Map<FeatureId, Decision>): {
    totalRemaining: number;
    unlimitedFeatures: FeatureId[];
    limitedFeatures: Array<{ featureId: FeatureId; remaining: number; resetAt?: string }>;
    blockedFeatures: FeatureId[];
  } {
    let totalRemaining = 0;
    const unlimitedFeatures: FeatureId[] = [];
    const limitedFeatures: Array<{ featureId: FeatureId; remaining: number; resetAt?: string }> = [];
    const blockedFeatures: FeatureId[] = [];

    for (const [featureId, decision] of decisions) {
      if (!decision.allow) {
        blockedFeatures.push(featureId);
      } else if (decision.remaining === -1) {
        unlimitedFeatures.push(featureId);
        totalRemaining = -1; // If any feature is unlimited, total is unlimited
      } else {
        limitedFeatures.push({
          featureId,
          remaining: decision.remaining,
          resetAt: decision.resetAtUtc
        });
        if (totalRemaining !== -1) {
          totalRemaining += decision.remaining;
        }
      }
    }

    return {
      totalRemaining,
      unlimitedFeatures,
      limitedFeatures,
      blockedFeatures
    };
  }

  /**
   * Determines if content should show an upgrade prompt
   */
  static shouldShowUpgradePrompt(decision: Decision, plan: string): boolean {
    if (decision.allow) return false;
    if (decision.reason !== 'limit_reached') return false;
    
    // Show upgrade prompt for guest and free users
    return plan === 'guest' || plan === 'free';
  }

  /**
   * Gets the appropriate upgrade target based on current plan
   */
  static getUpgradeTarget(currentPlan: string): {
    targetPlan: string;
    message: string;
    benefits: string[];
  } {
    switch (currentPlan) {
      case 'guest':
        return {
          targetPlan: 'free',
          message: 'Sign up for free to get 5 daily practices',
          benefits: [
            '5 daily practices for each feature',
            'Progress tracking',
            'Personalized learning stats'
          ]
        };
      case 'free':
        return {
          targetPlan: 'premium_monthly',
          message: 'Upgrade to Premium for unlimited practice',
          benefits: [
            'Unlimited daily practices',
            'Priority support',
            'Advanced statistics',
            'No ads'
          ]
        };
      default:
        return {
          targetPlan: 'premium_monthly',
          message: 'Get unlimited access with Premium',
          benefits: ['Unlimited practice', 'All features unlocked']
        };
    }
  }
}