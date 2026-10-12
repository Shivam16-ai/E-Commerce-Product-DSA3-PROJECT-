import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TEAM_MEMBERS } from '../../data/mockData';
import {
  Sparkles,
  ArrowRight,
  GitMerge,
  Layers,
  Database,
  Cpu,
  ShieldCheck,
  Zap,
  TrendingUp,
  CheckCircle2,
  Share2,
  RefreshCw,
  Search,
  ChevronRight,
  Code2,
  BarChart4
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OrbitalSphereBackground } from '../../shaders/orbital-sphere/OrbitalSphereBackground';
import '../../shaders/threeui.css';

export const LandingPage: React.FC = () => {
  const { navigateTo } = useApp();
  const [resolutionStep, setResolutionStep] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const simulatePipeline = () => {
    setIsSimulating(true);
    setResolutionStep(1);
    setTimeout(() => setResolutionStep(2), 700);
    setTimeout(() => setResolutionStep(3), 1400);
    setTimeout(() => {
      setResolutionStep(4);
      setIsSimulating(false);
    }, 2100);
  };

  return (
    <div id="landing-page-container" className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16 rounded-3xl bg-gradient-to-b from-blue-900/10 via-purple-900/10 to-transparent border border-slate-200/80 dark:border-slate-800/80 p-6 sm:p-10">
        {/* Orbital Sphere Three.js background */}
        <div className="shader-frame pointer-events-none" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <OrbitalSphereBackground
            speed={1.00}
            particleSize={0.015}
            particleOpacity={0.80}
            orbitOpacity={0.25}
            hue={0}
            scale={1.00}
            haloOpacity={0.20}
          />
        </div>
        {/* Decorative background glows */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Gen Enterprise Entity Resolution Engine</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white"
          >
            Unify Disparate E-Commerce Catalogs into a{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-300 dark:to-purple-400 bg-clip-text text-transparent">
              Single Source of Truth
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed"
          >
            High-throughput deep learning and Locality Sensitive Hashing (LSH) to identify duplicate listings,
            reconcile cross-seller variations, and power accurate price discovery across Amazon, Flipkart, Walmart, and Google Shopping.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-3 pt-2"
          >
            <button
              id="hero-launch-dashboard-btn"
              onClick={() => navigateTo('dashboard')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Explore Resolution Console</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              id="hero-view-matching-btn"
              onClick={() => navigateTo('matching')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-xs"
            >
              <GitMerge className="w-4 h-4 text-purple-500" />
              <span>Inspect Match Candidates</span>
            </button>

            <button
              id="hero-simulate-btn"
              onClick={simulatePipeline}
              disabled={isSimulating}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
              <span>Simulate Pipeline</span>
            </button>
          </motion.div>
        </div>

        {/* Animated Interactive Product Comparison & Resolution Canvas */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7, ease: 'easeOut' }}
          className="mt-12 max-w-5xl mx-auto relative z-10"
        >
          {/* Animated orbital glow border */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
            className="absolute -inset-[1px] rounded-2xl pointer-events-none"
            style={{
              background: 'conic-gradient(from 0deg, transparent 60%, rgba(139,92,246,0.5) 80%, rgba(99,102,241,0.6) 90%, rgba(139,92,246,0.5) 100%, transparent)',
              borderRadius: '1rem',
            }}
          />

          <div className="relative rounded-2xl bg-black/30 backdrop-blur-2xl border border-white/8 shadow-2xl p-5 sm:p-8 overflow-hidden">

            {/* Shimmer sweep line */}
            <motion.div
              animate={{ x: ['-100%', '250%'] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'linear', repeatDelay: 3 }}
              className="absolute top-0 left-0 h-px w-2/5 bg-gradient-to-r from-transparent via-violet-400/70 to-transparent pointer-events-none z-10"
            />

            {/* Floating orbital particle dots (decorative, match sphere aesthetic) */}
            {[
              { top: '12%', left: '8%', delay: 0, size: 3, color: 'bg-indigo-400' },
              { top: '70%', left: '3%', delay: 1.2, size: 2, color: 'bg-purple-400' },
              { top: '30%', left: '92%', delay: 0.6, size: 2.5, color: 'bg-violet-300' },
              { top: '80%', left: '88%', delay: 1.8, size: 2, color: 'bg-blue-400' },
              { top: '50%', left: '50%', delay: 0.9, size: 1.5, color: 'bg-purple-300' },
            ].map((dot, i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 2.5 + i * 0.4, delay: dot.delay, ease: 'easeInOut' }}
                className={`absolute rounded-full pointer-events-none ${dot.color}`}
                style={{ top: dot.top, left: dot.left, width: dot.size * 2, height: dot.size * 2 }}
              />
            ))}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-white/10">
              <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                  Live Resolution Simulator
                </span>
                <h3 className="text-lg font-bold text-white">
                  Multi-Seller Feed Disambiguation & Canonical Synthesis
                </h3>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 }} className="flex items-center gap-2">
                <span className="text-xs text-white/40">Pipeline State:</span>
                <motion.span
                  key={resolutionStep}
                  initial={{ opacity: 0, scale: 0.8, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 backdrop-blur-sm"
                >
                  {resolutionStep === 0 && 'Ready to Ingest'}
                  {resolutionStep === 1 && '1. Tokenizing Raw Titles'}
                  {resolutionStep === 2 && '2. MinHash LSH Blocking'}
                  {resolutionStep === 3 && '3. Cosine Spec Alignment'}
                  {resolutionStep === 4 && '4. Canonical Graph Unified (99.4%)'}
                </motion.span>
              </motion.div>
            </div>

            {/* Visual Flow Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-6">

              {/* Left Column: Seller Listings */}
              <div className="lg:col-span-5 space-y-3">
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                  className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  Disparate Raw Seller Listings
                </motion.div>

                {/* Amazon */}
                <motion.div
                  initial={{ opacity: 0, x: -24 }}
                  animate={{
                    opacity: 1, x: 0,
                    borderColor: resolutionStep >= 2 ? 'rgba(129,140,248,0.7)' : 'rgba(255,255,255,0.08)',
                    boxShadow: resolutionStep >= 2 ? '0 0 18px rgba(129,140,248,0.2)' : 'none',
                    scale: resolutionStep === 1 ? 1.02 : 1,
                  }}
                  transition={{ delay: 0.65, duration: 0.5 }}
                  className="p-3.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/8 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-400">Amazon SP-API</span>
                    <span className="font-mono text-[10px] text-white/30">SKU: B0CHX1W3</span>
                  </div>
                  <p className="font-medium text-white/80 line-clamp-1">Apple iPhone 15 Pro Max 256GB Natural Titanium (Unlocked)</p>
                  <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <span className="bg-amber-500/15 text-amber-300 px-1.5 py-0.5 rounded-sm">Price: ₹1,24,900</span>
                    <span>UPC: 195949038297</span>
                  </div>
                </motion.div>

                {/* Flipkart */}
                <motion.div
                  initial={{ opacity: 0, x: -24 }}
                  animate={{
                    opacity: 1, x: 0,
                    borderColor: resolutionStep >= 2 ? 'rgba(129,140,248,0.7)' : 'rgba(255,255,255,0.08)',
                    boxShadow: resolutionStep >= 2 ? '0 0 18px rgba(129,140,248,0.2)' : 'none',
                    scale: resolutionStep === 1 ? 1.02 : 1,
                  }}
                  transition={{ delay: 0.75, duration: 0.5 }}
                  className="p-3.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/8 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-400">Flipkart Seller Hub</span>
                    <span className="font-mono text-[10px] text-white/30">SKU: FK-IPH15-256NT</span>
                  </div>
                  <p className="font-medium text-white/80 line-clamp-1">Apple - iPhone 15 Pro Max 256 GB - Natural Titanium 5G Phone</p>
                  <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <span className="bg-blue-500/15 text-blue-300 px-1.5 py-0.5 rounded-sm">Price: ₹1,28,900</span>
                    <span>Brand: Apple Inc</span>
                  </div>
                </motion.div>

                {/* Walmart */}
                <motion.div
                  initial={{ opacity: 0, x: -24 }}
                  animate={{
                    opacity: 1, x: 0,
                    borderColor: resolutionStep >= 2 ? 'rgba(129,140,248,0.7)' : 'rgba(255,255,255,0.08)',
                    boxShadow: resolutionStep >= 2 ? '0 0 18px rgba(129,140,248,0.2)' : 'none',
                    scale: resolutionStep === 1 ? 1.02 : 1,
                  }}
                  transition={{ delay: 0.85, duration: 0.5 }}
                  className="p-3.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/8 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-400">Walmart Marketplace</span>
                    <span className="font-mono text-[10px] text-white/30">SKU: WM-994821</span>
                  </div>
                  <p className="font-medium text-white/80 line-clamp-1">Apple iPhone 15 ProMax 256GB Nat Titanium 6.7" OLED</p>
                  <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <span className="bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded-sm">Price: ₹1,27,900</span>
                    <span>Model: MU773LL/A</span>
                  </div>
                </motion.div>
              </div>

              {/* Middle Column: EntiMatch AI Node */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.95, type: 'spring', stiffness: 200, damping: 15 }}
                className="lg:col-span-2 flex flex-col items-center justify-center py-4 text-center"
              >
                <div className="relative">
                  {/* Orbital pulse rings (mirrors sphere orbits) */}
                  {resolutionStep > 0 && resolutionStep < 4 && (
                    <>
                      <motion.div
                        animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
                        transition={{ repeat: Infinity, duration: 1.1, ease: 'easeOut' }}
                        className="absolute inset-0 rounded-2xl bg-purple-500/30"
                      />
                      <motion.div
                        animate={{ scale: [1, 2.4], opacity: [0.3, 0] }}
                        transition={{ repeat: Infinity, duration: 1.1, delay: 0.35, ease: 'easeOut' }}
                        className="absolute inset-0 rounded-2xl bg-indigo-500/20"
                      />
                    </>
                  )}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-purple-500/40 relative z-10">
                    <Cpu className={`w-8 h-8 ${resolutionStep > 0 && resolutionStep < 4 ? 'animate-spin' : ''}`} />
                  </div>
                  {resolutionStep >= 3 && (
                    <motion.div
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 12 }}
                      className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-1 shadow-md z-20"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </motion.div>
                  )}
                </div>
                <span className="text-[11px] font-bold mt-3 text-white/80">EntiMatch AI</span>
                <motion.span
                  key={resolutionStep}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[10px] text-white/40 mt-0.5 font-mono"
                >
                  {resolutionStep === 4 ? 'Score: 99.4%' : 'LSH Blocking'}
                </motion.span>
                <div className="w-full h-px bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 my-2 rounded-full" />
                <span className="text-[10px] text-purple-400 font-semibold">Graph Merge</span>
              </motion.div>

              {/* Right Column: Canonical Master Entity */}
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1, duration: 0.6 }}
                className="lg:col-span-5"
              >
                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  Canonical Master Entity (ID: can-001)
                </div>

                <motion.div
                  animate={{
                    borderColor: resolutionStep === 4 ? '#a855f7' : 'rgba(168,85,247,0.2)',
                    boxShadow: resolutionStep === 4 ? '0 0 36px rgba(168,85,247,0.4), inset 0 0 20px rgba(168,85,247,0.05)' : 'none',
                  }}
                  className="p-4 rounded-xl bg-white/5 backdrop-blur-sm border-2 border-purple-500/20 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src="https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=150&q=80"
                      alt="Canonical Master"
                      className="w-16 h-16 rounded-lg object-cover border border-white/10"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                          3 Sellers Unified
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20">
                          99.4% Match
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-white mt-1 leading-snug">
                        Apple iPhone 15 Pro Max (256 GB) - Natural Titanium
                      </h4>
                      <p className="text-[11px] text-white/40">
                        Brand: <span className="font-semibold text-white/60">Apple</span> | UPC: 195949038297
                      </p>
                    </div>
                  </div>

                  {/* Price Strip */}
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/8 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/40 font-medium">Best Deal / Buy-Box:</span>
                      <span className="font-bold text-emerald-400 text-sm">
                        ₹1,24,900 <span className="text-[10px] text-white/25 line-through">₹1,29,900</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-white/30 border-t border-white/5 pt-1">
                      <span>Lowest: Amazon (₹1,24,900)</span>
                      <span>Highest: Flipkart (₹1,28,900)</span>
                      <span className="text-purple-400 font-semibold">Spread: ₹4,000</span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

            </div>
          </div>
        </motion.div>
      </section>

      {/* Statistics Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            value: '2.8M+',
            label: 'Catalog Entities Resolved',
            sub: 'Across 6 Major Retail Feeds',
            icon: Database,
            color: 'text-blue-600 dark:text-blue-400'
          },
          {
            value: '99.4%',
            label: 'Entity Match Accuracy',
            sub: 'Validated on 500K SKUs',
            icon: CheckCircle2,
            color: 'text-emerald-600 dark:text-emerald-400'
          },
          {
            value: '57 ms',
            label: 'Avg. Pipeline Latency',
            sub: 'LSH Blocking + Embeddings',
            icon: Zap,
            color: 'text-purple-600 dark:text-purple-400'
          },
          {
            value: '₹35 Cr',
            label: 'Arbitrage Opportunity Found',
            sub: 'Cross-seller price dispersion',
            icon: TrendingUp,
            color: 'text-indigo-600 dark:text-indigo-400'
          }
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-2xl sm:text-3xl font-black ${stat.color}`}>{stat.value}</span>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <Icon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </div>
              </div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{stat.label}</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{stat.sub}</p>
            </div>
          );
        })}
      </section>

      {/* Project Overview & Key Challenges Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            The Multi-Seller E-Commerce Dilemma
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
            Why Standard Keyword Search Fails in Modern Product Intelligence
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            In modern multi-seller platforms like Amazon, Flipkart, and Walmart, sellers publish identical products
            using divergent titles, missing UPCs, colloquial brand spellings, and messy attribute dictionaries.
          </p>
          <div className="space-y-2.5 pt-2">
            {[
              'Disparate Title Noise: "iPhone 15 Pro Max 256GB" vs "Apple - iPhone 15 Pro Max 256 GB 5G"',
              'Cross-Platform Model Variations: Wholesale club suffixes (e.g. S90C vs S90CD) triggering false matches',
              'Price Dispersion & Phantom Deals: Lack of canonical linkage masks actual Buy-Box price leaders',
              'Redundant Storage & Ad Waste: Running bidding ads on 4 duplicate listings of the exact same SKU'
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="mt-0.5 p-1 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                </div>
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xl space-y-4 border border-indigo-800/40">
          <div className="flex items-center justify-between border-b border-indigo-800/50 pb-3">
            <span className="text-xs font-mono text-purple-300 flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-purple-400" />
              resolution_pipeline_config.json
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
              v3.8 Production
            </span>
          </div>
          <pre className="text-[11px] font-mono text-slate-300 leading-relaxed overflow-x-auto p-2 bg-black/40 rounded-lg">
            {`{
  "entity_engine": "EntiMatch-LSH-v3",
  "blocking": {
    "algorithm": "MinHash-LSH",
    "num_perm": 128,
    "jaccard_threshold": 0.72
  },
  "deep_scoring": {
    "vector_model": "text-embedding-3-large",
    "spec_weight": 0.40,
    "title_weight": 0.35,
    "gtin_exact_override": true
  },
  "clustering": {
    "method": "Hierarchical-Agglomerative",
    "auto_merge_cutoff": 0.92,
    "human_review_range": [0.75, 0.91]
  }
}`}
          </pre>
          <div className="flex items-center justify-between text-xs pt-1 text-slate-400">
            <span>Throughput: 18,400 items / sec</span>
            <span className="text-emerald-400 font-semibold">Latency: 57.2ms p99</span>
          </div>
        </div>
      </section>

      {/* How Product Matching Works Section */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Architecture Blueprint
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            How The Resolution Pipeline Operates
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            A 5-stage deterministic and neural pipeline engineered for billion-scale catalog operations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            {
              step: '01',
              title: 'Ingestion & Cleaning',
              desc: 'Pulls feeds from Amazon, Flipkart, Walmart, stripping HTML tags, seller emojis, and standardizing units (GB, inches, grams).',
              icon: Database
            },
            {
              step: '02',
              title: 'Attribute Extraction',
              desc: 'Regex extractors and NLP parse RAM, Storage, Color, Generation, and MPN model numbers from unformatted text strings.',
              icon: Code2
            },
            {
              step: '03',
              title: 'MinHash LSH Blocking',
              desc: 'Reduces N² pairwise combinations to sub-linear time by mapping products into hash buckets based on k-shingle overlap.',
              icon: Cpu
            },
            {
              step: '04',
              title: 'Similarity Scoring',
              desc: 'Computes ensemble score: Weighted average of Title Jaccard (35%), Spec Match (40%), and Dense Vector Cosine (25%).',
              icon: BarChart4
            },
            {
              step: '05',
              title: 'Canonical Clustering',
              desc: 'Hierarchical graph clustering unifies identical candidates into a master Canonical ID with live multi-seller price tracking.',
              icon: GitMerge
            }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative group hover:border-purple-500/40 transition-all"
              >
                <div className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 mb-2">
                  STAGE {item.step}
                </div>
                <div className="p-2.5 w-fit rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 mb-3 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">{item.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Core Platform Features Section */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Enterprise Feature Suite
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Comprehensive Capabilities for Retail Intelligence
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: 'Side-by-Side Product Matching',
              desc: 'Inspect pairwise candidate attributes side-by-side with granular title, brand, and spec difference highlights.',
              action: () => navigateTo('matching'),
              actionText: 'Open Matcher'
            },
            {
              title: 'Unified Canonical 360° View',
              desc: 'Single unified master page aggregating all marketplace seller offerings, stock status, and shipping terms.',
              action: () => navigateTo('canonical', { canonicalId: 'can-001' }),
              actionText: 'View Canonical View'
            },
            {
              title: 'Cross-Seller Price Engine',
              desc: 'Track price dispersion across Amazon, Walmart, Flipkart, identifying the instant buy-box leader and margin leaks.',
              action: () => navigateTo('price-comparison'),
              actionText: 'Price Comparison'
            },
            {
              title: 'Automated Deduplication Hub',
              desc: 'Identify cluster redundancies caused by variant typos and 1-click consolidate them into clean master catalogs.',
              action: () => navigateTo('duplicate-detection'),
              actionText: 'Detect Duplicates'
            },
            {
              title: 'LSH & Latency Analytics',
              desc: 'Deep telemetry on bucket collisions, distribution histograms, and stage-by-stage runtime bottlenecks.',
              action: () => navigateTo('analytics'),
              actionText: 'View Analytics'
            },
            {
              title: 'Marketplace Connector Hub',
              desc: 'Live integrations for Amazon SP-API, Flipkart Marketplace API, Best Buy Developer feed, and Walmart feeds.',
              action: () => navigateTo('admin'),
              actionText: 'Feed Governance'
            }
          ].map((feat, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between hover:border-indigo-500/40 transition-all"
            >
              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{feat.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{feat.desc}</p>
              </div>
              <button
                onClick={feat.action}
                className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center justify-between"
              >
                <span>{feat.actionText}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Team Information Section */}
      <section className="space-y-6 pt-4">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Entity Resolution Pioneers
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Built by E-Commerce Catalog Veterans
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Engineered by former catalog infrastructure architects from Google Shopping, Amazon, and Flipkart.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TEAM_MEMBERS.map((member, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs text-center space-y-3"
            >
              <img
                src={member.avatar}
                alt={member.name}
                className="w-20 h-20 rounded-full mx-auto object-cover ring-4 ring-purple-500/20"
              />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{member.name}</h3>
                <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 mt-0.5">
                  {member.role}
                </p>
                <p className="text-[10px] text-slate-400">{member.affiliation}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-medium">
                Focus: {member.specialty}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Call-to-Action Bottom Banner */}
      <section className="rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 text-white p-8 sm:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="max-w-3xl space-y-4 relative z-10">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Ready to Unify Your Multi-Platform Catalog?
          </h2>
          <p className="text-sm sm:text-base text-purple-100 leading-relaxed">
            Eliminate duplicate listings, reclaim buy-box margins, and build clean canonical product graphs today.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => navigateTo('dashboard')}
              className="px-6 py-3 rounded-xl bg-white text-indigo-700 font-bold text-sm shadow-lg hover:bg-slate-100 transition-all"
            >
              Open Live Dashboard
            </button>
            <button
              onClick={() => navigateTo('upload')}
              className="px-6 py-3 rounded-xl bg-indigo-900/60 hover:bg-indigo-900/80 text-white font-semibold text-sm border border-indigo-300/30 transition-all"
            >
              Upload Product CSV/JSON
            </button>
          </div>
        </div>
      </section>

      {/* Enterprise Footer */}
      <footer className="pt-8 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold text-xs">
            E
          </div>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            EntiMatch Enterprise Platform
          </span>
          <span>© 2026. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hover:text-purple-600 cursor-pointer" onClick={() => navigateTo('landing')}>Architecture</span>
          <span className="hover:text-purple-600 cursor-pointer" onClick={() => navigateTo('admin')}>API Connectors</span>
          <span className="hover:text-purple-600 cursor-pointer" onClick={() => navigateTo('analytics')}>F1 Metrics</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono">
            SOC2 Type II Compliant
          </span>
        </div>
      </footer>
    </div>
  );
};
