"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyReminderEligibilityJob = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const logger = __importStar(require("firebase-functions/logger"));
const CRON_SECRET = (0, params_1.defineSecret)('CRON_SECRET');
function getAppUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app';
}
/**
 * Daily reminder eligibility scheduler.
 *
 * Runs at 18:00 UTC and triggers the server-side eligibility job that:
 * - computes "used yesterday, not today" in user timezone
 * - builds top 5 eligible features per user
 * - creates + sends custom email campaigns
 */
exports.dailyReminderEligibilityJob = (0, scheduler_1.onSchedule)({
    schedule: '0 18 * * *',
    timeZone: 'UTC',
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 540,
    retryCount: 1,
    secrets: [CRON_SECRET],
}, async (event) => {
    const appUrl = getAppUrl();
    const endpoint = `${appUrl}/api/notifications/reminder-summary`;
    logger.info('[ReminderEligibilityScheduler] Triggered', {
        scheduleTime: event.scheduleTime,
        jobName: event.jobName,
        endpoint,
    });
    const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${CRON_SECRET.value()}`,
            'Content-Type': 'application/json',
        },
    });
    const bodyText = await response.text();
    if (!response.ok) {
        logger.error('[ReminderEligibilityScheduler] Job request failed', {
            status: response.status,
            body: bodyText,
        });
        throw new Error(`Reminder summary job failed: ${response.status}`);
    }
    logger.info('[ReminderEligibilityScheduler] Job request succeeded', {
        status: response.status,
        body: bodyText.slice(0, 1000),
    });
});
//# sourceMappingURL=reminderEligibilityScheduler.js.map