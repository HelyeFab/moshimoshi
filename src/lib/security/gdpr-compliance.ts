import { adminFirestore } from '../firebase/admin';
import { ComponentLogger } from '../monitoring/logger';
import crypto from 'crypto';

const logger = new ComponentLogger('gdpr-compliance');

/**
 * GDPR Compliance Module
 * Implements data protection requirements under GDPR
 */

export interface UserDataExport {
  personalData: {
    userId: string;
    email: string;
    name?: string;
    createdAt: Date;
    lastLogin?: Date;
  };
  learningData: {
    reviewSessions: any[];
    progress: any;
    achievements: any[];
  };
  preferences: {
    language: string;
    notifications: boolean;
    theme: string;
  };
  consent: {
    marketing: boolean;
    analytics: boolean;
    timestamp: Date;
  };
}

export class GDPRCompliance {
  /**
   * Export all user data (GDPR Article 20 - Right to data portability)
   */
  static async exportUserData(userId: string): Promise<UserDataExport> {
    try {
      logger.info('User data export requested', { userId });

      const db = adminFirestore!;
      
      // Collect user data from all collections
      const [userDoc, sessionsSnapshot, progressDoc, preferencesDoc] = await Promise.all([
        db.collection('users').doc(userId).get(),
        db.collection('review_sessions')
          .where('userId', '==', userId)
          .orderBy('createdAt', 'desc')
          .limit(100)
          .get(),
        db.collection('user_progress').doc(userId).get(),
        db.collection('user_preferences').doc(userId).get(),
      ]);

      const userData = userDoc.data() || {};
      const sessions = sessionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Remove internal fields
        _internal: undefined,
      }));
      const progress = progressDoc.data() || {};
      const preferences = preferencesDoc.data() || {};

      // Anonymize sensitive data
      const exportData: UserDataExport = {
        personalData: {
          userId: userData.userId,
          email: userData.email,
          name: userData.displayName,
          createdAt: userData.createdAt?.toDate(),
          lastLogin: userData.lastLogin?.toDate(),
        },
        learningData: {
          reviewSessions: sessions,
          progress: progress,
          achievements: userData.achievements || [],
        },
        preferences: {
          language: preferences.language || 'en',
          notifications: preferences.notifications !== false,
          theme: preferences.theme || 'light',
        },
        consent: {
          marketing: userData.marketingConsent || false,
          analytics: userData.analyticsConsent || false,
          timestamp: userData.consentTimestamp?.toDate() || new Date(),
        },
      };

      // Log the export for audit trail
      await this.logDataAccess(userId, 'EXPORT', 'User data exported');

      return exportData;
    } catch (error) {
      logger.error('Failed to export user data', { userId, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Delete all user data (GDPR Article 17 - Right to erasure)
   */
  static async deleteUserData(userId: string, reason: string): Promise<void> {
    try {
      logger.info('User data deletion requested', { userId, reason });

      const db = adminFirestore!;
      const batch = db.batch();

      // Delete from all collections
      const collections = [
        'users',
        'user_progress',
        'user_preferences',
        'user_subscriptions',
        'review_sessions',
        'review_items',
        'offline_sync',
      ];

      for (const collection of collections) {
        // Delete document if it's a single doc per user
        if (['users', 'user_progress', 'user_preferences', 'user_subscriptions'].includes(collection)) {
          const docRef = db.collection(collection).doc(userId);
          batch.delete(docRef);
        } else {
          // Query and delete multiple documents
          const snapshot = await db.collection(collection)
            .where('userId', '==', userId)
            .get();
          
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
        }
      }

      // Commit the batch delete
      await batch.commit();

      // Log the deletion for audit trail (anonymized)
      await this.logDataAccess(
        this.anonymizeUserId(userId),
        'DELETE',
        `User data deleted. Reason: ${reason}`
      );

      logger.info('User data deleted successfully', { userId: this.anonymizeUserId(userId) });
    } catch (error) {
      logger.error('Failed to delete user data', { userId, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Anonymize user data instead of deletion
   */
  static async anonymizeUserData(userId: string): Promise<void> {
    try {
      logger.info('User data anonymization requested', { userId });

      const db = adminFirestore!;
      const anonymousId = this.generateAnonymousId(userId);

      // Update user document with anonymized data
      await db.collection('users').doc(userId).update({
        email: `anonymous-${anonymousId}@deleted.local`,
        displayName: `Anonymous User ${anonymousId}`,
        phoneNumber: null,
        photoURL: null,
        // Keep learning data but anonymize personal info
        anonymized: true,
        anonymizedAt: new Date(),
      });

      // Log the anonymization
      await this.logDataAccess(
        anonymousId,
        'ANONYMIZE',
        'User data anonymized'
      );

      logger.info('User data anonymized successfully', { anonymousId });
    } catch (error) {
      logger.error('Failed to anonymize user data', { userId, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Update user consent preferences
   */
  static async updateConsent(
    userId: string,
    consent: {
      marketing?: boolean;
      analytics?: boolean;
      necessary?: boolean;
    }
  ): Promise<void> {
    try {
      const db = adminFirestore!;
      
      await db.collection('users').doc(userId).update({
        marketingConsent: consent.marketing || false,
        analyticsConsent: consent.analytics || false,
        necessaryConsent: consent.necessary !== false, // Default true
        consentTimestamp: new Date(),
        consentIP: null, // Don't store IP for privacy
      });

      // Log consent update
      await this.logDataAccess(userId, 'CONSENT_UPDATE', JSON.stringify(consent));

      logger.info('User consent updated', { userId, consent });
    } catch (error) {
      logger.error('Failed to update consent', { userId, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Get data retention policy
   */
  static getRetentionPolicy() {
    return {
      activeUserData: '3 years',
      inactiveUserData: '1 year',
      deletedUserData: '30 days',
      auditLogs: '7 years',
      sessionData: '90 days',
      temporaryData: '7 days',
      backups: '30 days',
    };
  }

  /**
   * Check if data retention period has expired
   */
  static async enforceDataRetention(): Promise<void> {
    try {
      const db = adminFirestore!;
      const now = new Date();

      // Delete old session data (>90 days)
      const sessionCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const oldSessions = await db.collection('review_sessions')
        .where('createdAt', '<', sessionCutoff)
        .get();

      const batch = db.batch();
      oldSessions.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      logger.info('Data retention enforced', {
        deletedSessions: oldSessions.size,
      });
    } catch (error) {
      logger.error('Failed to enforce data retention', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Generate data processing report
   */
  static async generateProcessingReport(userId: string) {
    const db = adminFirestore!;
    
    // Get all data processing activities
    const activities = await db.collection('audit_logs')
      .where('userId', '==', userId)
      .where('category', '==', 'DATA_PROCESSING')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    return {
      userId,
      reportDate: new Date(),
      activities: activities.docs.map(doc => ({
        timestamp: doc.data().timestamp?.toDate(),
        action: doc.data().action,
        purpose: doc.data().purpose,
        lawfulBasis: doc.data().lawfulBasis || 'legitimate_interest',
      })),
      dataCategories: [
        'Personal identification data',
        'Learning progress data',
        'Usage analytics',
        'Preference settings',
      ],
      recipients: [
        'Internal processing only',
        'Stripe (payment processing)',
        'Firebase (data storage)',
      ],
      internationalTransfers: false,
      securityMeasures: [
        'Encryption at rest',
        'Encryption in transit',
        'Access control',
        'Regular security audits',
      ],
    };
  }

  /**
   * Cookie consent management
   */
  static getCookiePolicy() {
    return {
      necessary: {
        name: 'Necessary Cookies',
        description: 'Required for the website to function properly',
        cookies: ['session', 'csrf_token', 'auth_token'],
        canDisable: false,
      },
      analytics: {
        name: 'Analytics Cookies',
        description: 'Help us understand how you use our service',
        cookies: ['_ga', '_gid', 'amplitude_id'],
        canDisable: true,
      },
      marketing: {
        name: 'Marketing Cookies',
        description: 'Used to show relevant advertisements',
        cookies: ['fbp', 'gcl_au'],
        canDisable: true,
      },
    };
  }

  /**
   * Private helper methods
   */
  private static anonymizeUserId(userId: string): string {
    return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8);
  }

  private static generateAnonymousId(userId: string): string {
    return crypto.createHash('md5').update(userId + Date.now()).digest('hex').substring(0, 8);
  }

  private static async logDataAccess(
    userId: string,
    action: string,
    details: string
  ): Promise<void> {
    try {
      const db = adminFirestore!;
      await db.collection('audit_logs').add({
        userId,
        action,
        details,
        category: 'DATA_PROCESSING',
        timestamp: new Date(),
        ip: null, // Don't log IP for privacy
      });
    } catch (error) {
      logger.error('Failed to log data access', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}

/**
 * Privacy-preserving analytics
 */
export class PrivacyAnalytics {
  /**
   * Log analytics event without PII
   */
  static logEvent(
    eventName: string,
    properties: Record<string, any>,
    userId?: string
  ) {
    // Remove any PII from properties
    const sanitized = this.sanitizeProperties(properties);
    
    // Use hashed user ID if provided
    const hashedUserId = userId ? 
      crypto.createHash('sha256').update(userId).digest('hex') : 
      'anonymous';

    logger.info('Analytics event', {
      event: eventName,
      properties: sanitized,
      userId: hashedUserId,
    });
  }

  private static sanitizeProperties(properties: Record<string, any>) {
    const piiFields = ['email', 'name', 'phone', 'address', 'ip', 'creditCard'];
    const sanitized = { ...properties };

    piiFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}

// Export for use in API routes
export default {
  GDPRCompliance,
  PrivacyAnalytics,
};