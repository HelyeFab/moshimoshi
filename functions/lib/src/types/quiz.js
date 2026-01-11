"use strict";
/**
 * Unified Quiz Types for Moshimoshi
 *
 * This file defines the unified quiz question interface used across:
 * - Stories (StoryQuizQuestion)
 * - Comics (ComicQuizQuestion)
 * - News Articles (future)
 *
 * BREAKING CHANGE: Unifies correctIndex (legacy stories) and correctAnswer (comics)
 * into a single correctAnswer field that can be either a number (for multiple-choice)
 * or a string (for fill-in-blank questions).
 */
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMultipleChoiceQuestion = isMultipleChoiceQuestion;
exports.isFillBlankQuestion = isFillBlankQuestion;
exports.migrateLegacyQuizQuestion = migrateLegacyQuizQuestion;
exports.isValidQuizQuestion = isValidQuizQuestion;
exports.normalizeAnswer = normalizeAnswer;
exports.isAnswerCorrect = isAnswerCorrect;
/**
 * Type guard to check if a question is multiple-choice (correctAnswer is number)
 *
 * @param question - The quiz question to check
 * @returns True if the question uses numeric answer (index)
 *
 * @example
 * if (isMultipleChoiceQuestion(question)) {
 *   const selectedOption = question.options[question.correctAnswer]
 * }
 */
function isMultipleChoiceQuestion(question) {
    return typeof question.correctAnswer === 'number';
}
/**
 * Type guard to check if a question is fill-in-blank (correctAnswer is string)
 *
 * @param question - The quiz question to check
 * @returns True if the question uses string answer
 *
 * @example
 * if (isFillBlankQuestion(question)) {
 *   const isCorrect = userAnswer.trim().toLowerCase() === question.correctAnswer.toLowerCase()
 * }
 */
function isFillBlankQuestion(question) {
    return typeof question.correctAnswer === 'string';
}
/**
 * Migrate a legacy story quiz question to the new unified format
 *
 * Converts correctIndex (number) to correctAnswer (number) and adds type field.
 * This is safe because story questions are always multiple-choice.
 *
 * @param legacy - Legacy quiz question with correctIndex field
 * @returns Unified quiz question with correctAnswer field
 *
 * @example
 * const legacyQuestion = {
 *   id: 'q1',
 *   question: 'What is the capital of Japan?',
 *   options: ['Tokyo', 'Osaka', 'Kyoto', 'Nagoya'],
 *   correctIndex: 0
 * }
 * const modernQuestion = migrateLegacyQuizQuestion(legacyQuestion)
 * // modernQuestion.correctAnswer === 0
 * // modernQuestion.type === 'multiple-choice'
 */
function migrateLegacyQuizQuestion(legacy) {
    const { correctIndex } = legacy, rest = __rest(legacy, ["correctIndex"]);
    return Object.assign(Object.assign({}, rest), { correctAnswer: correctIndex, type: 'multiple-choice' });
}
/**
 * Validate that a quiz question has the required fields
 *
 * @param question - The question to validate
 * @returns True if the question is valid
 */
function isValidQuizQuestion(question) {
    // Required fields
    if (!question.id || !question.question || !question.options || question.options.length === 0) {
        return false;
    }
    // correctAnswer must exist and be either string or number
    if (question.correctAnswer === undefined || question.correctAnswer === null) {
        return false;
    }
    // If correctAnswer is a number, it must be a valid index
    if (typeof question.correctAnswer === 'number') {
        if (question.correctAnswer < 0 || question.correctAnswer >= question.options.length) {
            return false;
        }
    }
    return true;
}
/**
 * Normalize a user's answer for comparison
 *
 * For string answers (fill-in-blank), this trims whitespace and converts to lowercase.
 * For numeric answers, returns as-is.
 *
 * @param answer - The user's answer
 * @returns Normalized answer for comparison
 */
function normalizeAnswer(answer) {
    if (typeof answer === 'string') {
        return answer.trim().toLowerCase();
    }
    return answer;
}
/**
 * Check if a user's answer is correct
 *
 * @param question - The quiz question
 * @param userAnswer - The user's answer (can be index or string)
 * @returns True if the answer is correct
 *
 * @example
 * // Multiple choice (numeric answer)
 * isAnswerCorrect(question, 2) // true if option index 2 is correct
 *
 * // Fill-in-blank (string answer)
 * isAnswerCorrect(question, "Tokyo") // true if "tokyo" matches (case-insensitive)
 */
function isAnswerCorrect(question, userAnswer) {
    if (userAnswer === null || userAnswer === undefined) {
        return false;
    }
    // Normalize both answers for comparison
    const normalizedCorrect = normalizeAnswer(question.correctAnswer);
    const normalizedUser = normalizeAnswer(userAnswer);
    return normalizedCorrect === normalizedUser;
}
//# sourceMappingURL=quiz.js.map