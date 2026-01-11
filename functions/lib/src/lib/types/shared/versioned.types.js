"use strict";
/**
 * Versioned Data Types
 *
 * Adds version tracking to all data structures for conflict detection.
 * Fixes Issue #3: No version tracking in legacy mode
 *
 * Design Decisions:
 * - All mutable data structures must implement Versioned
 * - Version increments on every write
 * - Enables optimistic concurrency control
 * - Prevents lost updates in concurrent scenarios
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionUtils = exports.ConflictResolution = exports.VersionConflictError = void 0;
/**
 * Version conflict error
 * Thrown when version mismatch detected
 */
class VersionConflictError extends Error {
    constructor(message, expected, actual) {
        super(message);
        this.expected = expected;
        this.actual = actual;
        this.name = 'VersionConflictError';
    }
}
exports.VersionConflictError = VersionConflictError;
/**
 * Conflict resolution strategies
 */
var ConflictResolution;
(function (ConflictResolution) {
    /**
     * Server wins - discard local changes
     * Safe default for most cases
     */
    ConflictResolution["SERVER_WINS"] = "server_wins";
    /**
     * Client wins - overwrite server
     * Use with caution, can cause data loss
     */
    ConflictResolution["CLIENT_WINS"] = "client_wins";
    /**
     * Merge - attempt to merge changes
     * Complex, requires custom logic
     */
    ConflictResolution["MERGE"] = "merge";
    /**
     * Manual - require user intervention
     * Show conflict UI
     */
    ConflictResolution["MANUAL"] = "manual";
})(ConflictResolution || (exports.ConflictResolution = ConflictResolution = {}));
/**
 * Versioning utilities
 */
exports.VersionUtils = {
    /**
     * Check if version matches expected
     */
    checkVersion(actual, expected) {
        return actual === expected;
    },
    /**
     * Throw if version mismatch
     */
    assertVersion(actual, expected) {
        if (!exports.VersionUtils.checkVersion(actual, expected)) {
            throw new VersionConflictError(`Version mismatch: expected ${expected}, got ${actual}`, expected, actual);
        }
    },
    /**
     * Increment version
     */
    incrementVersion(version) {
        return version + 1;
    },
    /**
     * Create initial versioned data
     */
    createVersioned(data) {
        return Object.assign(Object.assign({}, data), { version: 1, updatedAt: new Date().toISOString() });
    },
    /**
     * Update versioned data
     */
    updateVersioned(data, updates) {
        return Object.assign(Object.assign(Object.assign({}, data), updates), { version: exports.VersionUtils.incrementVersion(data.version), updatedAt: new Date().toISOString() });
    }
};
//# sourceMappingURL=versioned.types.js.map