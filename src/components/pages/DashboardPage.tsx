import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Layers,
  GitMerge,
  CopyX,
  Store,
  CheckCircle2,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Zap,
  Clock,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { MATCH_ANALYTICS_DATA } from '../../data/mockData';
import { getAnalyticsSummary, ApiError, AnalyticsSummary } from '../../lib/api';

export const DashboardPage: React.FC = () => {
  const {
    products,
    canonicalProducts,
    matchPairs,
    duplicateClusters,
    sellerFeeds,
    auditLogs,
    navigateTo,
    approveMatch,
    mergeDuplicateCluster
  } = useApp();

  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Load analytics on component mount
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const data = await getAnalyticsSummary();
        setAnalytics(data);
      } catch (error) {
        console.error('Failed to load analytics:', error);
        setAnalytics(null);
      } finally {
        setAnalyticsLoading(false);
      }
    };
    void loadAnalytics();
  }, []);

  const pendingMatches = matchPairs.filter((m) => m.matchStatus === 'Pending Review');
  const activeDuplicates = duplicateClusters.filter((c) => c.status === 'Active Redundancy');
  const activeSellersCount = sellerFeeds.filter((f) => f.active).length;

  const filteredLogs = auditLogs.filter((log) => {
    if (activityFilter === 'all') return true;
    return log.type === activityFilter;
  });

  const pieData = [
    { name: 'High Confidence (≥90%)', value: 72, color: '#10b981' },
    { name: 'Medium Review (75-89%)', value: 21, color: '#f59e0b' },
    { name: 'Low / Discard (<75%)', value: 7, color: '#f43f5e' }
  ];

  return (
    <div id="dashboard-page-container" className="space-y-8 pb-16">
      {/* Top Welcome / Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Live Production Cluster
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            Product Entity Resolution Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time multi-marketplace deduplication telemetry, similarity scoring, and canonical master catalog state.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigateTo('upload')}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:shadow-md transition-all"
          >
            + Ingest New Feed
          </button>
          <button
            onClick={() => navigateTo('matching')}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors"
          >
            Review {pendingMatches.length} Matches
          </button>
        </div>
      </div>

      {/* 5 Primary Metrics KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Total Products */}
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold">Total Raw Ingested</span>
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {analyticsLoading ? '...' : (analytics?.totalProducts ?? 0).toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
              <ArrowUpRight className="w-3 h-3" /> {products.length > 0 ? '+' + products.length : 'loading'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Across {sellerFeeds.length} connected seller feeds</p>
        </div>

        {/* Metric 2: Matched Products */}
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold">Resolved Canonical</span>
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <GitMerge className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {analyticsLoading ? '...' : (analytics?.canonicalProducts ?? 0).toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
              {canonicalProducts.length} Active in view
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Multi-seller offers linked to master</p>
        </div>

        {/* Metric 3: Duplicate Listings */}
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold">Duplicate Listings</span>
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <CopyX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400">
              {analyticsLoading ? '...' : (analytics?.activeClusters ?? 0).toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-amber-500">
              {duplicateClusters.length} Redundant clusters
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Preventing SKU cannibalization</p>
        </div>

        {/* Metric 4: Sellers Count */}
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold">Active Seller Channels</span>
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {sellerFeeds.filter((f) => f.active).length} / {sellerFeeds.length}
            </span>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              Online
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Amazon, Flipkart, Walmart, Best Buy...</p>
        </div>

        {/* Metric 5: Pending Matches */}
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold">Pending Matches</span>
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {analyticsLoading ? '...' : (analytics?.pendingMatches ?? 0).toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              {matchPairs.filter((m) => m.matchStatus === 'Pending Review').length} in session
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting operator review</p>
        </div>
      </div>

      {/* Interactive Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Chart: Resolution Throughput Trend (AreaChart) */}
        <div className="lg:col-span-8 p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Monthly Ingestion vs. Canonical Resolution Throughput
              </h3>
              <p className="text-xs text-slate-500">Volume of products successfully resolved per month</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-blue-600">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Ingested
              </span>
              <span className="flex items-center gap-1.5 text-purple-600">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600" /> Resolved
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MATCH_ANALYTICS_DATA.monthlyTrends}>
                <defs>
                  <linearGradient id="colorIngested" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip
                  formatter={(value: any) => [Number(value).toLocaleString(), 'Items']}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    fontSize: '12px'
                  }}
                />
                <Area type="monotone" dataKey="totalIngested" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorIngested)" name="Total Ingested" />
                <Area type="monotone" dataKey="matchedResolved" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorResolved)" name="Resolved Masters" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart: Match Confidence Breakdown */}
        <div className="lg:col-span-4 p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              Confidence Score Distribution
            </h3>
            <p className="text-xs text-slate-500">Pipeline confidence band allocation</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val) => [`${val}%`, 'Proportion']}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {pieData.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
                </div>
                <span className="font-bold text-slate-800 dark:text-slate-200">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Quick Actions on Top Match Candidates + Recent Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Top Match Candidate & Top Duplicate Cluster */}
        <div className="lg:col-span-6 space-y-6">
          {/* Candidate Card */}
          <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Priority Action Item
                </span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  High-Confidence Candidate Awaiting Approval
                </h3>
              </div>
              <button
                onClick={() => navigateTo('matching')}
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1 hover:underline"
              >
                <span>All ({pendingMatches.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {pendingMatches.length > 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                    Similarity: {pendingMatches[0].overallScore}%
                  </span>
                  <span className="text-[11px] text-slate-400">{pendingMatches[0].timestamp}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60">
                    <span className="text-[10px] font-semibold text-amber-600">Amazon Source</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2 mt-0.5">
                      {pendingMatches[0].primaryProduct.title}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">Price: ₹{pendingMatches[0].primaryProduct.price.toLocaleString('en-IN')}</p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60">
                    <span className="text-[10px] font-semibold text-blue-600">
                      {pendingMatches[0].secondaryProduct.source} Source
                    </span>
                    <p className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2 mt-0.5">
                      {pendingMatches[0].secondaryProduct.title}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">Price: ₹{pendingMatches[0].secondaryProduct.price.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 italic">
                  Reason: {pendingMatches[0].detectedReason}
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => approveMatch(pendingMatches[0].id)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                  >
                    ✓ Approve Match
                  </button>
                  <button
                    onClick={() => navigateTo('matching')}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    Inspect Side-by-Side
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                All high-confidence candidate matches have been reviewed!
              </div>
            )}
          </div>

          {/* Active Redundant Duplicate Cluster Widget */}
          <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Deduplication Opportunity
                </span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Identified Multi-Seller Redundancy Cluster
                </h3>
              </div>
              <button
                onClick={() => navigateTo('duplicate-detection')}
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1 hover:underline"
              >
                <span>View All ({activeDuplicates.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeDuplicates.length > 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {activeDuplicates[0].canonicalTitle}
                  </span>
                  <span className="text-emerald-600 font-bold">
                    Est. Savings: ₹{activeDuplicates[0].potentialSavingsEstimate.toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Contains {activeDuplicates[0].items.length} duplicate variations from Amazon, Flipkart, Walmart with average title similarity of {activeDuplicates[0].averageSimilarity}%.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => mergeDuplicateCluster(activeDuplicates[0].id)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors"
                  >
                    Consolidate {activeDuplicates[0].items.length} Listings into Single Master
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                Catalog duplicate clusters resolved.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Activity Feed & Audit Stream */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Live Audit & Telemetry Stream
              </h3>
              <p className="text-xs text-slate-500">Operator overrides and automated cluster resolutions</p>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setActivityFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  activityFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActivityFilter('merge')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  activityFilter === 'merge'
                    ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Merges
              </button>
              <button
                onClick={() => setActivityFilter('override')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  activityFilter === 'override'
                    ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Overrides
              </button>
              <button
                onClick={() => setActivityFilter('import')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  activityFilter === 'import'
                    ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                LSH Batch
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex gap-3 text-xs"
              >
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0 h-fit mt-0.5">
                  {log.type === 'merge' && <GitMerge className="w-4 h-4 text-purple-500" />}
                  {log.type === 'override' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  {log.type === 'import' && <Zap className="w-4 h-4 text-blue-500" />}
                  {log.type === 'rule_change' && <ShieldCheck className="w-4 h-4 text-indigo-500" />}
                  {log.type === 'verification' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">{log.timestamp}</span>
                  </div>
                  <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 mt-0.5 truncate">
                    {log.target}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {log.details}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span>By:</span>
                    <span className="font-mono text-slate-600 dark:text-slate-300">{log.user}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
