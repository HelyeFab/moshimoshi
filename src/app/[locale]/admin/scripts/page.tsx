'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase/client';
import Modal from '@/components/ui/Modal';

interface ParamConfig {
  [key: string]: {
    type: 'boolean' | 'number' | 'text';
    label: string;
  };
}

interface Script {
  id: string;
  file: string;
  description: string;
  requiresConfirmation: boolean;
  tier: 'critical' | 'high' | 'medium' | 'low';
  requiresParams?: boolean;
  paramConfig?: ParamConfig;
}

export default function AdminScriptsPage() {
  const { user } = useAuth();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [scriptOutput, setScriptOutput] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState<Script | null>(null);
  const [paramInput, setParamInput] = useState('');
  const [scriptParams, setScriptParams] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchScripts();
  }, []);

  const fetchScripts = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/scripts/run', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch scripts');

      const data = await response.json();
      setScripts(data.scripts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scripts');
    } finally {
      setLoading(false);
    }
  };

  const executeScript = async (script: Script) => {
    // Check if confirmation is needed
    if (script.requiresConfirmation) {
      setShowConfirm(script);
      return;
    }

    await runScript(script);
  };

  const runScript = async (script: Script) => {
    setShowConfirm(null);
    setExecuting(script.id);
    setScriptOutput('');
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const body: any = { scriptId: script.id };
      if (script.requiresParams) {
        if (script.paramConfig) {
          // Use the new multi-param system
          body.params = scriptParams[script.id] || {};
        } else if (paramInput) {
          // Legacy single param (videoId) for backwards compatibility
          body.params = { videoId: paramInput };
        }
      }

      const response = await fetch('/api/admin/scripts/run', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (data.success) {
        setScriptOutput(data.output);
        setShowOutput(true);
      } else {
        throw new Error(data.error || 'Script execution failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute script');
      setScriptOutput(err instanceof Error ? err.message : 'Unknown error');
      setShowOutput(true);
    } finally {
      setExecuting(null);
      setParamInput('');
      setScriptParams({});
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'critical': return 'from-red-500 to-red-700';
      case 'high': return 'from-orange-500 to-orange-700';
      case 'medium': return 'from-blue-500 to-blue-700';
      case 'low': return 'from-gray-500 to-gray-700';
      default: return 'from-gray-500 to-gray-700';
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'medium': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const groupedScripts = {
    critical: scripts.filter(s => s.tier === 'critical'),
    high: scripts.filter(s => s.tier === 'high'),
    medium: scripts.filter(s => s.tier === 'medium'),
    low: scripts.filter(s => s.tier === 'low')
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full space-y-6"
    >
      {/* Page Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-100 via-primary-50 to-transparent dark:from-primary-900/20 dark:via-primary-800/10 dark:to-transparent rounded-2xl p-6 shadow-sm">
        <div className="relative">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent">
            🛠️ Admin Scripts
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Execute maintenance and diagnostic scripts
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200 text-sm">❌ {error}</p>
        </div>
      )}

      {/* Critical Scripts */}
      {groupedScripts.critical.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">🔴</span> Critical Operations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupedScripts.critical.map((script) => (
              <ScriptCard
                key={script.id}
                script={script}
                executing={executing === script.id}
                onExecute={() => executeScript(script)}
                getTierColor={getTierColor}
                getTierBadge={getTierBadge}
                paramInput={paramInput}
                setParamInput={setParamInput}
                scriptParams={scriptParams}
                setScriptParams={setScriptParams}
              />
            ))}
          </div>
        </div>
      )}

      {/* High Priority Scripts */}
      {groupedScripts.high.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">🟡</span> Testing & Data Management
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupedScripts.high.map((script) => (
              <ScriptCard
                key={script.id}
                script={script}
                executing={executing === script.id}
                onExecute={() => executeScript(script)}
                getTierColor={getTierColor}
                getTierBadge={getTierBadge}
                paramInput={paramInput}
                setParamInput={setParamInput}
                scriptParams={scriptParams}
                setScriptParams={setScriptParams}
              />
            ))}
          </div>
        </div>
      )}

      {/* Medium Priority Scripts */}
      {groupedScripts.medium.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">🟢</span> System Maintenance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupedScripts.medium.map((script) => (
              <ScriptCard
                key={script.id}
                script={script}
                executing={executing === script.id}
                onExecute={() => executeScript(script)}
                getTierColor={getTierColor}
                getTierBadge={getTierBadge}
                paramInput={paramInput}
                setParamInput={setParamInput}
                scriptParams={scriptParams}
                setScriptParams={setScriptParams}
              />
            ))}
          </div>
        </div>
      )}

      {/* Low Priority Scripts */}
      {groupedScripts.low.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">🔵</span> Diagnostics & Health Checks
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupedScripts.low.map((script) => (
              <ScriptCard
                key={script.id}
                script={script}
                executing={executing === script.id}
                onExecute={() => executeScript(script)}
                getTierColor={getTierColor}
                getTierBadge={getTierBadge}
                paramInput={paramInput}
                setParamInput={setParamInput}
                scriptParams={scriptParams}
                setScriptParams={setScriptParams}
              />
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <Modal isOpen={true} onClose={() => setShowConfirm(null)} title="Confirm Script Execution">
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to run <strong>{showConfirm.file}</strong>?
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {showConfirm.description}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => runScript(showConfirm)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Yes, Run Script
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Output Modal */}
      {showOutput && (
        <Modal isOpen={true} onClose={() => setShowOutput(false)} title="Script Output">
          <div className="space-y-4">
            <pre className="p-4 bg-gray-900 text-green-400 rounded-lg overflow-auto max-h-96 text-xs font-mono scrollbar-hide">
              {scriptOutput || 'No output'}
            </pre>
            <div className="flex justify-end">
              <button
                onClick={() => setShowOutput(false)}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </motion.div>
  );
}

function ScriptCard({
  script,
  executing,
  onExecute,
  getTierColor,
  getTierBadge,
  paramInput,
  setParamInput,
  scriptParams,
  setScriptParams
}: {
  script: Script;
  executing: boolean;
  onExecute: () => void;
  getTierColor: (tier: string) => string;
  getTierBadge: (tier: string) => string;
  paramInput: string;
  setParamInput: (value: string) => void;
  scriptParams: Record<string, any>;
  setScriptParams: (params: Record<string, any>) => void;
}) {
  const handleParamChange = (paramKey: string, value: any) => {
    setScriptParams({
      ...scriptParams,
      [script.id]: {
        ...(scriptParams[script.id] || {}),
        [paramKey]: value,
      },
    });
  };
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-dark-700/50 p-6 shadow-lg"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              {script.file.replace('.ts', '')}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {script.description}
            </p>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTierBadge(script.tier)}`}>
            {script.tier.toUpperCase()}
          </span>
        </div>

        {script.requiresParams && script.paramConfig && (
          <div className="space-y-2">
            {Object.entries(script.paramConfig).map(([paramKey, paramDef]) => {
              const currentValue = scriptParams[script.id]?.[paramKey];

              if (paramDef.type === 'boolean') {
                return (
                  <label key={paramKey} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentValue || false}
                      onChange={(e) => handleParamChange(paramKey, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">{paramDef.label}</span>
                  </label>
                );
              }

              if (paramDef.type === 'number') {
                return (
                  <div key={paramKey}>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      {paramDef.label}
                    </label>
                    <input
                      type="number"
                      value={currentValue || ''}
                      onChange={(e) => handleParamChange(paramKey, e.target.value ? parseInt(e.target.value) : null)}
                      placeholder={paramDef.label}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                );
              }

              // text type
              return (
                <div key={paramKey}>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    {paramDef.label}
                  </label>
                  <input
                    type="text"
                    value={currentValue || ''}
                    onChange={(e) => handleParamChange(paramKey, e.target.value)}
                    placeholder={paramDef.label}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              );
            })}
          </div>
        )}

        {script.requiresParams && !script.paramConfig && (
          <input
            type="text"
            value={paramInput}
            onChange={(e) => setParamInput(e.target.value)}
            placeholder="Enter video ID..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-white text-sm"
          />
        )}

        <button
          onClick={onExecute}
          disabled={executing}
          className={`w-full px-4 py-2 bg-gradient-to-r ${getTierColor(script.tier)} text-white rounded-lg font-medium transition-all ${
            executing ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
          }`}
        >
          {executing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Running...
            </span>
          ) : (
            '▶️ Run Script'
          )}
        </button>
      </div>
    </motion.div>
  );
}
