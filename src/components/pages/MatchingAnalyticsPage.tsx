import React from 'react';
import { useApp } from '../../context/AppContext';
import { MATCH_ANALYTICS_DATA } from '../../data/mockData';
import {
  BarChart3,
  Cpu,
  Zap,
  TrendingUp,
  Activity,
  Layers,
  Database,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend
} from 'recharts';

export const MatchingAnalyticsPage: React.FC = () => {
  return (
    <div id="matching-analytics-page-container" className="space-y-8 pb-16">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Algorithmic Telemetry & Benchmarks
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            Search & Entity Matching Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            LSH bucket collision efficiency, dense embedding similarity distributions, and pipeline latency profiles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            99.4% F1 Precision Benchmark
          </span>
        </div>
      </div>

      {/* Top Telemetry KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">Match Success Rate</span>
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">99.4%</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3 h-3" /> +0.5% YoY
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Precision 99.7% | Recall 99.1%</p>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">LSH Candidate Reduction</span>
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">99.88%</span>
            <span className="text-xs font-bold text-blue-600">128 Perm</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">N² comparisons pruned via MinHash</p>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">End-to-End Pipeline Latency</span>
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">57.2 ms</span>
            <span className="text-xs font-bold text-emerald-600">p99: 84ms</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">18,400 product pairs / second</p>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">Embedding Model Latency</span>
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">24.8 ms</span>
            <span className="text-xs font-bold text-purple-600">1536-dim</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Cosine vector similarity stage</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Similarity Distribution Histogram */}
        <div className="lg:col-span-8 p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              Pairwise Similarity Score Distribution Histogram
            </h3>
            <p className="text-xs text-slate-500">
              Frequency of scored candidate pairs across similarity brackets (0.0 to 1.0)
            </p>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MATCH_ANALYTICS_DATA.similarityDistribution}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="range" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  formatter={(val: any) => [Number(val).toLocaleString(), 'Candidate Pairs']}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Candidate Pairs" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Latency Stage Breakdown */}
        <div className="lg:col-span-4 p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              Stage-by-Stage Latency Budget
            </h3>
            <p className="text-xs text-slate-500">Time spent in each resolution phase</p>
          </div>

          <div className="space-y-3 pt-2">
            {MATCH_ANALYTICS_DATA.latencyBreakdown.map((stage, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{stage.stage}</span>
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                    {stage.timeMs} ms
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full"
                    style={{ width: `${(stage.timeMs / 25) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 text-xs">
            <span className="font-bold text-purple-700 dark:text-purple-300 block">Total Pipeline Time:</span>
            <span className="text-slate-600 dark:text-slate-400">
              57.2ms average per candidate cluster batch
            </span>
          </div>
        </div>
      </div>

      {/* Category Accuracy Table */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            Entity Resolution Accuracy by Retail Category
          </h3>
          <p className="text-xs text-slate-500">Validation benchmarks run against human-verified gold ground truth datasets</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MATCH_ANALYTICS_DATA.categoryAccuracy.map((cat, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">{cat.category}</span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {cat.accuracy}% Accuracy
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Validated on {cat.items.toLocaleString()} ground-truth items
              </p>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${cat.accuracy}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
