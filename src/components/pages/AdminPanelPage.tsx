import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  Settings,
  Sliders,
  Database,
  Store,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  ListFilter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Save,
  Server,
  Layers,
  Activity
} from 'lucide-react';
import { SellerFeedConfig, AuditLogEntry } from '../../types';

export const AdminPanelPage: React.FC = () => {
  const {
    sellerFeeds,
    toggleSellerFeed,
    auditLogs,
    autoMergeThreshold,
    setAutoMergeThreshold,
    addToast
  } = useApp();

  const [activeTab, setActiveTab] = useState<'weights' | 'sellers' | 'rules' | 'audit'>('weights');

  const [auditTypeFilter, setAuditTypeFilter] = useState<string>('all');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditPage, setAuditPage] = useState<number>(1);
  const auditPageSize = 8;

  const [algorithmWeights, setAlgorithmWeights] = useState({
    titleWeight: 35,
    brandWeight: 25,
    attributeWeight: 25,
    imageWeight: 15
  });

  const updateAlgorithmWeights = (partial: Partial<typeof algorithmWeights>) => {
    setAlgorithmWeights((prev) => ({ ...prev, ...partial }));
  };

  const syncSellerNow = (sellerName: string) => {
    addToast(
      'Feed Ingestion Polled',
      `Manual delta pull initialized for ${sellerName} SKU stream.`,
      'info'
    );
  };

  // Rule configuration toggles state
  const [cleaningRules, setCleaningRules] = useState([
    {
      id: 'strip-promos',
      name: 'Strip Promotional Keywords',
      desc: 'Removes strings like "[HOT SALE]", "Free Shipping", "Limited Stock", "2024 New Arrival" prior to tokenization',
      enabled: true
    },
    {
      id: 'normalize-units',
      name: 'Normalize Metric & Imperial Dimensions',
      desc: 'Converts "6.7 in" to "6.7-inch", "1 TB" to "1024GB", "30 hrs" to "30-hours" for exact spec equivalence',
      enabled: true
    },
    {
      id: 'dedup-brand-tokens',
      name: 'De-duplicate Title Brand Prefix',
      desc: 'Eliminates repetitive brand name tokens (e.g. "Apple Apple iPhone 15" -> "Apple iPhone 15")',
      enabled: true
    },
    {
      id: 'lsh-band-pruning',
      name: 'Dynamic LSH Permutation Pruning',
      desc: 'Automatically prune MinHash signatures with Jaccard coefficient less than 0.35 before dense embedding generation',
      enabled: true
    }
  ]);

  const toggleRule = (id: string) => {
    setCleaningRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
    addToast(
      'Rule Setting Updated',
      'Pipeline tokenization config re-indexed in real time.',
      'info'
    );
  };

  const handleSaveWeights = () => {
    addToast(
      'Algorithm Weights Deployed',
      'Ensemble model scoring parameters updated successfully across cluster nodes.',
      'success'
    );
  };

  return (
    <div id="admin-panel-page-container" className="space-y-8 pb-16">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Control Plane & Policy Engine
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            Enterprise Admin & System Configuration
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Calibrate similarity weights, manage connected retail ingest feeds, customize normalization rules, and review audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              addToast(
                'Global Cache Flushed',
                'All worker nodes synchronized with latest rules and weights.',
                'success'
              );
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Flush Cache</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 w-fit text-xs font-semibold">
        <button
          onClick={() => setActiveTab('weights')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'weights'
              ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Similarity Algorithm Weights</span>
        </button>

        <button
          onClick={() => setActiveTab('sellers')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'sellers'
              ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>Seller Feed Connectors ({sellerFeeds.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'rules'
              ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>Schema & Cleaning Rules</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Audit Logs</span>
        </button>
      </div>

      {/* Tab 1: Algorithm Weights */}
      {activeTab === 'weights' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Ensemble Matching Weights Matrix
                </h3>
                <p className="text-xs text-slate-500">
                  Configure feature importance distribution across lexical, structural, and vision models. (Sum: 100%)
                </p>
              </div>

              <button
                onClick={handleSaveWeights}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors flex items-center gap-1.5 self-start"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save & Deploy Weights</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Title Weight */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Product Title / N-Gram Weight
                  </span>
                  <span className="font-mono font-extrabold text-purple-600 dark:text-purple-400 text-sm">
                    {algorithmWeights.titleWeight}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={algorithmWeights.titleWeight}
                  onChange={(e) => updateAlgorithmWeights({ titleWeight: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <p className="text-[11px] text-slate-400">
                  Calculated using TF-IDF token overlap and character trigram Jaccard index.
                </p>
              </div>

              {/* Brand Weight */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Brand & Manufacturer Exact Match Weight
                  </span>
                  <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                    {algorithmWeights.brandWeight}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={algorithmWeights.brandWeight}
                  onChange={(e) => updateAlgorithmWeights({ brandWeight: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-[11px] text-slate-400">
                  Leverages brand synonym dictionary (e.g. Sony Corp vs Sony Electronics).
                </p>
              </div>

              {/* Attributes / MPN Weight */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Attribute & MPN / UPC Compatibility Weight
                  </span>
                  <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
                    {algorithmWeights.attributeWeight}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={algorithmWeights.attributeWeight}
                  onChange={(e) => updateAlgorithmWeights({ attributeWeight: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <p className="text-[11px] text-slate-400">
                  Evaluates model number, storage capacity, color variants, and GTIN codes.
                </p>
              </div>

              {/* Image Hash Weight */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Perceptual Image Hash (pHash) Weight
                  </span>
                  <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                    {algorithmWeights.imageWeight}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={algorithmWeights.imageWeight}
                  onChange={(e) => updateAlgorithmWeights({ imageWeight: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <p className="text-[11px] text-slate-400">
                  Hamming distance on 64-bit DCT perceptual hash for hero product photos.
                </p>
              </div>
            </div>

            {/* Threshold Setting */}
            <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/80 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Zero-Human-Touch Autonomous Merge Threshold
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Candidate pairs exceeding this ensemble score are automatically merged into canonical entities.
                  </span>
                </div>
                <span className="font-mono font-extrabold text-purple-600 dark:text-purple-400 text-lg">
                  {autoMergeThreshold}%
                </span>
              </div>
              <input
                type="range"
                min="80"
                max="98"
                value={autoMergeThreshold}
                onChange={(e) => setAutoMergeThreshold(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Seller Feeds */}
      {activeTab === 'sellers' && (
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Connected E-Commerce Feed Connectors
              </h3>
              <p className="text-xs text-slate-500">
                Manage ingestion endpoints, polling schedules, and API sync states.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                <tr>
                  <th className="p-3">Retail Channel</th>
                  <th className="p-3">Catalog Size</th>
                  <th className="p-3">Sync Schedule</th>
                  <th className="p-3">Last Ingest</th>
                  <th className="p-3">Connector Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sellerFeeds.map((s: SellerFeedConfig) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Store className="w-4 h-4 text-purple-500" />
                      <span>{s.name}</span>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400 font-mono">
                      {s.productsIngested.toLocaleString()} items
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{s.lastSync}</td>
                    <td className="p-3 text-slate-500 text-[11px] font-mono">{s.lastSync}</td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          s.active
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {s.active ? 'Connected' : 'Paused'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => syncSellerNow(s.name)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Sync</span>
                        </button>
                        <button
                          onClick={() => toggleSellerFeed(s.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                            s.active
                              ? 'text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {s.active ? 'Pause' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Cleaning Rules */}
      {activeTab === 'rules' && (
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Data Cleaning & NLP Normalization Rules
            </h3>
            <p className="text-xs text-slate-500">
              Transform unstructured retailer titles into standardized canonical tokens prior to entity hashing.
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {cleaningRules.map((rule) => (
              <div key={rule.id} className="py-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    {rule.name}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-2xl">{rule.desc}</p>
                </div>

                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`p-1 rounded-full transition-colors ${
                    rule.enabled ? 'text-purple-600' : 'text-slate-300 dark:text-slate-600'
                  }`}
                >
                  {rule.enabled ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Audit Logs */}
      {activeTab === 'audit' && (() => {
        const filtered = auditLogs.filter((log) => {
          const matchesType = auditTypeFilter === 'all' || log.type === auditTypeFilter;
          const q = auditSearch.toLowerCase().trim();
          const matchesQuery =
            !q ||
            log.action.toLowerCase().includes(q) ||
            log.target.toLowerCase().includes(q) ||
            log.user.toLowerCase().includes(q) ||
            (log.details && log.details.toLowerCase().includes(q));
          return matchesType && matchesQuery;
        });

        const totalPages = Math.max(1, Math.ceil(filtered.length / auditPageSize));
        const paginatedLogs = filtered.slice(
          (auditPage - 1) * auditPageSize,
          auditPage * auditPageSize
        );

        return (
          <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  System Audit Trails & Resolution Actions
                </h3>
                <p className="text-xs text-slate-500">
                  Immutable logs for regulatory compliance, manual curator decisions, and autonomous merges.
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Filter logs by actor, action..."
                  value={auditSearch}
                  onChange={(e) => {
                    setAuditSearch(e.target.value);
                    setAuditPage(1);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                />
                <select
                  value={auditTypeFilter}
                  onChange={(e) => {
                    setAuditTypeFilter(e.target.value);
                    setAuditPage(1);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium"
                >
                  <option value="all">All Event Types</option>
                  <option value="merge">Merges</option>
                  <option value="split">Splits</option>
                  <option value="attach">Attachments</option>
                  <option value="detach">Detachments</option>
                  <option value="verification">Verification</option>
                  <option value="override">Overrides</option>
                  <option value="undo">Undo / Rollback</option>
                  <option value="import">Imports</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                  <tr>
                    <th className="p-3">Timestamp (UTC)</th>
                    <th className="p-3">Action Performed</th>
                    <th className="p-3">Target Entity</th>
                    <th className="p-3">Initiated By</th>
                    <th className="p-3 text-right">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400 font-sans">
                        No audit events matching criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log: AuditLogEntry) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 text-slate-400">{log.timestamp}</td>
                        <td className="p-3 font-sans font-bold text-slate-800 dark:text-slate-200">
                          {log.action}
                        </td>
                        <td className="p-3 text-purple-600 dark:text-purple-400 truncate max-w-[200px]" title={log.target}>
                          {log.target}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{log.user}</td>
                        <td className="p-3 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                            {log.type}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination strip */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs pt-2">
                <span className="text-slate-400">
                  Showing {(auditPage - 1) * auditPageSize + 1} to{' '}
                  {Math.min(auditPage * auditPageSize, filtered.length)} of {filtered.length} entries
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={auditPage <= 1}
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Page {auditPage} of {totalPages}
                  </span>
                  <button
                    disabled={auditPage >= totalPages}
                    onClick={() => setAuditPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
