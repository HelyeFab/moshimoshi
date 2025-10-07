'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Loader2, AlertCircle } from 'lucide-react';
import { useFeature } from '@/hooks/useFeature';
import { useShowEntitlementModal } from '@/hooks/useEntitlementModal';
import type { Decision } from '@/hooks/useFeature';
import type { FeatureId } from '@/types/FeatureId';
import { useI18n } from '@/i18n/I18nContext';
import { useToast } from '@/components/ui/Toast/ToastContext';
import type { GrammarExplanation } from '@/lib/ai/types';

const FEATURE_ID = 'grammar_explanations' as FeatureId;

interface GrammarExplanationTriggerProps {
  sentence?: string;
  context?: string;
  surroundingSentences?: string[];
  focusQuestion?: string;
  title?: string;
  jlptLevel?: string;
  children?: (args: { open: () => void; loading: boolean; disabled: boolean }) => React.ReactNode;
  disabled?: boolean;
}

interface GrammarResponse {
  explanation: GrammarExplanation;
  cached: boolean;
}

export function GrammarExplanationTrigger({
  sentence,
  context,
  surroundingSentences,
  focusQuestion,
  title,
  jlptLevel,
  children,
  disabled = false
}: GrammarExplanationTriggerProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { checkOnly } = useFeature(FEATURE_ID);
  const showEntitlementModal = useShowEntitlementModal();

  const [isOpen, setIsOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<GrammarResponse | null>(null);

  const cacheRef = useRef<Map<string, GrammarResponse>>(new Map());

  const key = useMemo(() => {
    if (!sentence) return null;
    const contextKey = context ? context.slice(0, 200) : '';
    const surroundingKey = surroundingSentences?.join('|') ?? '';
    return `${sentence}__${contextKey}__${surroundingKey}`;
  }, [sentence, context, surroundingSentences]);

  const resetState = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  const openModal = useCallback(async () => {
    if (!sentence || disabled) {
      return;
    }

    setIsChecking(true);
    try {
      const decision = await checkOnly();
      handleDecision(decision);
    } catch (err) {
      console.error('[GrammarExplanation] Entitlement check failed', err);
      // Allow falling back to server-side enforcement
      setIsOpen(true);
    } finally {
      setIsChecking(false);
    }
  }, [sentence, disabled, checkOnly]);

  const handleDecision = useCallback((decision: Decision | null) => {
    if (decision && !decision.allow) {
      showEntitlementModal(decision, FEATURE_ID);
      return;
    }
    setIsOpen(true);
  }, [showEntitlementModal]);

  useEffect(() => {
    if (!isOpen || !sentence || !key) {
      return;
    }

    resetState();

    if (cacheRef.current.has(key)) {
      setResponse(cacheRef.current.get(key) || null);
      return;
    }

    let cancelled = false;
    const fetchExplanation = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetch('/api/grammar/explain', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sentence,
            context,
            surroundingSentences,
            focusQuestion,
            title,
            jlptLevel
          })
        });

        if (result.status === 403) {
          const data = await result.json();
          if (!cancelled && data?.decision) {
            setIsOpen(false);
            showEntitlementModal(data.decision, FEATURE_ID);
          }
          return;
        }

        if (result.status === 401) {
          setIsOpen(false);
          showToast(t('entitlements.messages.authenticationRequired'), 'warning');
          return;
        }

        if (!result.ok) {
          throw new Error('Request failed');
        }

        const data = await result.json() as { explanation: GrammarExplanation; cached: boolean };
        if (!cancelled) {
          const payload: GrammarResponse = {
            explanation: data.explanation,
            cached: data.cached
          };
          cacheRef.current.set(key, payload);
          setResponse(payload);
        }
      } catch (err) {
        console.error('[GrammarExplanation] Failed to fetch explanation', err);
        if (!cancelled) {
          setError(t('aiGrammar.error'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchExplanation();

    return () => {
      cancelled = true;
    };
  }, [isOpen, sentence, context, surroundingSentences, focusQuestion, title, jlptLevel, key, showEntitlementModal, showToast, t, resetState]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const triggerDisabled = disabled || !sentence || isChecking;
  const trigger = children
    ? children({ open: openModal, loading: isChecking || isLoading, disabled: triggerDisabled })
    : (
      <button
        type="button"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
        onClick={openModal}
        disabled={triggerDisabled}
      >
        {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        <span>{t('aiGrammar.trigger')}</span>
      </button>
    );

  const explanation = response?.explanation;
  const cached = response?.cached;

  return (
    <>
      {trigger}
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={t('aiGrammar.title')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-muted/40 dark:bg-dark-700/40 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t('aiGrammar.targetSentence')}</p>
            <p className="mt-1 text-lg font-medium text-foreground leading-relaxed">
              {sentence}
            </p>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-3 text-sm text-muted-foreground">{t('aiGrammar.analyzing')}</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-medium">{t('aiGrammar.errorTitle')}</p>
                <p className="mt-1 text-destructive/90">{error}</p>
              </div>
            </div>
          )}

          {explanation && !isLoading && !error && (
            <div className="space-y-6">
              {cached && (
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('aiGrammar.cachedLabel')}
                </div>
              )}

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">
                  {explanation.pattern}
                </h3>
                <p className="text-sm text-muted-foreground">{explanation.meaning}</p>
                {(explanation.formality || explanation.jlptLevel) && (
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {explanation.formality ? `${t('aiGrammar.formalityLabel')}: ${explanation.formality}` : ''}
                    {explanation.formality && explanation.jlptLevel ? ' • ' : ''}
                    {explanation.jlptLevel ? `JLPT ${explanation.jlptLevel}` : ''}
                  </p>
                )}
                {explanation.structure && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{t('aiGrammar.structureLabel')}:</span>{' '}
                    {explanation.structure}
                  </p>
                )}
              </section>

              {explanation.examples && explanation.examples.length > 0 && (
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    {t('aiGrammar.examplesLabel')}
                  </h4>
                  <div className="space-y-3">
                    {explanation.examples.map((example, index) => (
                      <div key={index} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                        <p className="text-sm font-medium text-foreground">{example.japanese}</p>
                        {example.furigana && (
                          <p className="text-xs text-muted-foreground mt-1">{example.furigana}</p>
                        )}
                        <p className="text-sm text-muted-foreground mt-2">{example.translation}</p>
                        {example.notes && (
                          <p className="text-xs text-muted-foreground mt-2 italic">{example.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {explanation.commonMistakes && explanation.commonMistakes.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    {t('aiGrammar.mistakesLabel')}
                  </h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {explanation.commonMistakes.map((mistake, index) => (
                      <li key={index}>{mistake}</li>
                    ))}
                  </ul>
                </section>
              )}

              {explanation.relatedPatterns && explanation.relatedPatterns.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    {t('aiGrammar.relatedLabel')}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {explanation.relatedPatterns.map((pattern, index) => (
                      <span key={index} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                        {pattern}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
