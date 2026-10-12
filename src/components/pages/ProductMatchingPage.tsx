import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MatchCandidatePair } from '../../types';
import {
  GitMerge,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sliders,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldAlert,
  Info,
  ExternalLink,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ProductMatchingPage: React.FC = () => {
  const {
    matchPairs,
    runEntityMatching,
    approveMatch,
    rejectMatch,
    mergeMatch,
    autoMergeThreshold,
    setAutoMergeThreshold,
    navigateTo
  } = useApp();

  const [selectedConfidence, setSelectedConfidence] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('Pending Review');
  const [inspectPair, setInspectPair] = useState<MatchCandidatePair | null>(null);
  const [isMatching, setIsMatching] = useState(false);

  const filteredPairs = matchPairs.filter((pair) => {
    const matchesConfidence = selectedConfidence === 'All' || pair.confidenceLevel === selectedConfidence;
    const matchesStatus = selectedStatus === 'All' || pair.matchStatus === selectedStatus;
    return matchesConfidence && matchesStatus;
  });

  const getConfidenceBadge = (level: string) => {
    switch (level) {
      case 'High':
        return 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'Medium':
        return 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'Low':
      default:
        return 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800';
    }
  };

  return (
    <div id="product-matching-page-container" className="space-y-8 pb-16">
      {/* Page Header Banner */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Entity Resolution Console
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            Product Matching & Verification Workbench
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Audit pairwise candidate listings identified by MinHash LSH and cosine spec vector distance.
          </p>
        </div>

        <button
          type="button"
          disabled={isMatching}
          onClick={async () => {
            setIsMatching(true);
            try { await runEntityMatching(); } finally { setIsMatching(false); }
          }}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white shadow-xs transition-colors flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isMatching ? 'animate-spin' : ''}`} />
          {isMatching ? 'Running Python Engine…' : 'Run Backend Matching'}
        </button>

        {/* Confidence Threshold Tuning Widget */}
        <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/80 flex items-center gap-3">
          <Sliders className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
          <div className="text-xs">
            <div className="flex justify-between items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
              <span>Auto-Merge Cutoff:</span>
              <span className="text-purple-600 dark:text-purple-400 font-mono font-bold">
                {autoMergeThreshold}%
              </span>
            </div>
            <input
              type="range"
              min="80"
              max="98"
              value={autoMergeThreshold}
              onChange={(e) => setAutoMergeThreshold(Number(e.target.value))}
              className="w-32 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-semibold">Confidence Band:</span>
          {(['All', 'High', 'Medium', 'Low'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedConfidence(lvl)}
              className={`px-3 py-1.5 rounded-full font-semibold transition-colors ${
                selectedConfidence === lvl
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {lvl} {lvl !== 'All' && 'Confidence'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold">Review Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium focus:outline-hidden"
          >
            <option value="All">All States ({matchPairs.length})</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Approved">Approved</option>
            <option value="Merged">Merged</option>
            <option value="Rejected">Rejected False Positives</option>
          </select>
        </div>
      </div>

      {/* Match Candidate Cards List */}
      <div className="space-y-6">
        {filteredPairs.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200">
              No match candidates found for the selected filters
            </h3>
            <p className="text-xs text-slate-400">
              Try changing the confidence level filter or review status.
            </p>
          </div>
        ) : (
          filteredPairs.map((pair) => (
            <div
              key={pair.id}
              className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-5"
            >
              {/* Candidate Top Strip */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400">
                    <GitMerge className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">Pair ID: {pair.id}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getConfidenceBadge(
                          pair.confidenceLevel
                        )}`}
                      >
                        {pair.confidenceLevel} Confidence ({pair.overallScore}%)
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        Status: {pair.matchStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Detected: <span className="font-medium text-slate-700 dark:text-slate-300">{pair.detectedReason}</span>
                    </p>
                  </div>
                </div>

                {/* Score Breakdown Pills */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                  <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Title: <strong className="text-purple-600">{pair.titleScore}%</strong>
                  </span>
                  <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Brand: <strong className="text-blue-600">{pair.brandScore}%</strong>
                  </span>
                  <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Spec: <strong className="text-indigo-600">{pair.attributeScore}%</strong>
                  </span>
                  <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    pHash: <strong className="text-emerald-600">{pair.imageScore}%</strong>
                  </span>
                </div>
              </div>

              {/* Side-by-Side Product Comparison Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                {/* Product A: Primary Entity */}
                <div className="lg:col-span-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      Product A (Primary Listing)
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                      Channel: {pair.primaryProduct.source}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <img
                      src={pair.primaryProduct.imageUrl}
                      alt={pair.primaryProduct.title}
                      className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2">
                        {pair.primaryProduct.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Brand: <span className="font-semibold text-slate-700 dark:text-slate-300">{pair.primaryProduct.brand}</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Price:</span>
                      <span className="font-bold text-slate-900 dark:text-white">₹{pair.primaryProduct.price.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Model:</span>
                      <span className="text-slate-700 dark:text-slate-300">{pair.primaryProduct.modelNumber}</span>
                    </div>
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">UPC / GTIN:</span>
                      <span className="text-purple-600 font-bold">{pair.primaryProduct.upcOrGtin}</span>
                    </div>
                  </div>

                  {/* Attributes */}
                  <div className="pt-1 flex flex-wrap gap-1">
                    {Object.entries(pair.primaryProduct.attributes).map(([k, v], i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700/80 text-[10px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                      >
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Center Match Bridge Indicator */}
                <div className="lg:col-span-2 flex flex-col items-center justify-center p-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950/80 border-2 border-purple-500 flex items-center justify-center text-purple-600 dark:text-purple-300 font-bold text-xs shadow-md">
                    {pair.overallScore}%
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 mt-2">
                    Ensemble Score
                  </span>
                  <div className="w-full h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 my-2 rounded-full hidden lg:block" />
                  <span className="text-[10px] text-slate-400 font-mono">
                    Δ Diff: {(100 - pair.overallScore).toFixed(1)}%
                  </span>
                </div>

                {/* Product B: Secondary Candidate */}
                <div className="lg:col-span-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Product B (Candidate Match)
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300">
                      Channel: {pair.secondaryProduct.source}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <img
                      src={pair.secondaryProduct.imageUrl}
                      alt={pair.secondaryProduct.title}
                      className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2">
                        {pair.secondaryProduct.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Brand: <span className="font-semibold text-slate-700 dark:text-slate-300">{pair.secondaryProduct.brand}</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Price:</span>
                      <span className="font-bold text-slate-900 dark:text-white">₹{pair.secondaryProduct.price.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Model:</span>
                      <span className="text-slate-700 dark:text-slate-300">{pair.secondaryProduct.modelNumber}</span>
                    </div>
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">UPC / GTIN:</span>
                      <span className="text-purple-600 font-bold">{pair.secondaryProduct.upcOrGtin}</span>
                    </div>
                  </div>

                  {/* Attributes */}
                  <div className="pt-1 flex flex-wrap gap-1">
                    {Object.entries(pair.secondaryProduct.attributes).map(([k, v], i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700/80 text-[10px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                      >
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Resolution Explainability & Evidence (Phase 2) */}
              {(pair.explanation || (pair.positiveEvidence && pair.positiveEvidence.length > 0) || (pair.conflictingEvidence && pair.conflictingEvidence.length > 0)) && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      Resolution Explainability & Evidence
                    </span>
                    {pair.recommendedAction && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-medium">
                        Recommended: {pair.recommendedAction}
                      </span>
                    )}
                  </div>
                  {pair.explanation && (
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                      {pair.explanation}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {pair.positiveEvidence && pair.positiveEvidence.length > 0 && (
                      <div className="p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                          ✓ Match Evidence
                        </span>
                        <ul className="space-y-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                          {pair.positiveEvidence.map((ev, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-emerald-500 font-bold">•</span>
                              <span>{ev}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {pair.conflictingEvidence && pair.conflictingEvidence.length > 0 && (
                      <div className="p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block mb-1">
                          ⚠ Conflicting Signals
                        </span>
                        <ul className="space-y-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                          {pair.conflictingEvidence.map((ev, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-amber-500 font-bold">•</span>
                              <span>{ev}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons Strip */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  <span>Match Action: </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {pair.matchStatus === 'Merged' ? 'Resolved into single Canonical Entity' : 'Awaiting confirmation'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => rejectMatch(pair.id)}
                    disabled={pair.matchStatus === 'Rejected'}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject False Positive</span>
                  </button>

                  <button
                    onClick={() => approveMatch(pair.id)}
                    disabled={pair.matchStatus === 'Approved' || pair.matchStatus === 'Merged'}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verify Relationship</span>
                  </button>

                  <button
                    onClick={() => mergeMatch(pair.id)}
                    disabled={pair.matchStatus === 'Merged'}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>Merge into Canonical Master</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
