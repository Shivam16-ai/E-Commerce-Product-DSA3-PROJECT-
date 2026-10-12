import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DuplicateCluster, ProductItem } from '../../types';
import {
  CopyX,
  Sparkles,
  GitMerge,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronRight,
  TrendingDown,
  Info,
  IndianRupee
} from 'lucide-react';

export const DuplicateDetectionPage: React.FC = () => {
  const { duplicateClusters, mergeDuplicateCluster, removeDuplicateItem, navigateTo } = useApp();

  const [activeTab, setActiveTab] = useState<'Active Redundancy' | 'Resolved'>('Active Redundancy');

  const filteredClusters = duplicateClusters.filter((c) =>
    activeTab === 'Active Redundancy' ? c.status === 'Active Redundancy' : c.status === 'Resolved'
  );

  const totalSavingsPotential = duplicateClusters
    .filter((c) => c.status === 'Active Redundancy')
    .reduce((sum, c) => sum + c.potentialSavingsEstimate, 0);

  return (
    <div id="duplicate-detection-page-container" className="space-y-8 pb-16">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Catalog Hygiene & Deduplication
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            Duplicate Detection & Redundancy Workbench
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Identify fragmented seller entries caused by typos, model suffixes, and title variance to eliminate duplicate ad spending.
          </p>
        </div>

        {/* Potential Savings Banner */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-purple-500/10 border border-rose-500/30 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">
              Redundant SKU Waste Potential
            </span>
            <span className="text-lg font-black text-rose-600 dark:text-rose-400">
              ₹{totalSavingsPotential.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Filter Strip */}
      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 w-fit text-xs font-semibold">
        <button
          onClick={() => setActiveTab('Active Redundancy')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'Active Redundancy'
              ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Active Redundancy Clusters ({duplicateClusters.filter((c) => c.status === 'Active Redundancy').length})
        </button>
        <button
          onClick={() => setActiveTab('Resolved')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'Resolved'
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Resolved Clusters ({duplicateClusters.filter((c) => c.status === 'Resolved').length})
        </button>
      </div>

      {/* Cluster Cards List */}
      <div className="space-y-6">
        {filteredClusters.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200">
              All duplicate clusters in this view have been resolved!
            </h3>
            <p className="text-xs text-slate-400">
              Your catalog is currently deduplicated with optimal canonical consolidation.
            </p>
          </div>
        ) : (
          filteredClusters.map((cluster) => (
            <div
              key={cluster.id}
              className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4"
            >
              {/* Top Cluster Strip */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400">
                    <CopyX className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">Cluster ID: {cluster.id}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300">
                        Avg Similarity: {cluster.averageSimilarity}%
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          cluster.status === 'Active Redundancy'
                            ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                            : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {cluster.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white mt-1">
                      {cluster.canonicalTitle}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right text-xs">
                    <span className="text-slate-400 block text-[10px]">Est. Ad Cannibalization Waste</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      ₹{cluster.potentialSavingsEstimate.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {cluster.status === 'Active Redundancy' && (
                    <button
                      onClick={() => mergeDuplicateCluster(cluster.id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xs transition-all flex items-center gap-1.5"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      <span>Consolidate Cluster ({cluster.items.length} SKUs)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Title Comparison & Divergence List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Raw Variation Breakdown & Token Diffs
                </span>

                <div className="space-y-2">
                  {cluster.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span className="text-purple-600 font-semibold">{item.source} Channel</span>
                            <span>•</span>
                            <span>SKU: {item.sourceSku}</span>
                            <span>•</span>
                            <span>UPC: {item.upcOrGtin}</span>
                            <span>•</span>
                            <span className="text-slate-700 dark:text-slate-300 font-bold">₹{item.price.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>

                      {cluster.status === 'Active Redundancy' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => removeDuplicateItem(cluster.id, item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Remove from this cluster"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
