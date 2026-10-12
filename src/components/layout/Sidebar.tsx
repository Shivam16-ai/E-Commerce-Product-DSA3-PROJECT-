import React from 'react';
import { useApp } from '../../context/AppContext';
import { PageId } from '../../types';
import {
  Home,
  LayoutDashboard,
  UploadCloud,
  Layers,
  GitMerge,
  Sparkles,
  IndianRupee,
  CopyX,
  BarChart3,
  ShieldCheck,
  ChevronRight,
  Database,
  Cpu,
  Command,
  Search
} from 'lucide-react';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeColor?: string;
  description: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { currentPage, navigateTo, matchPairs, duplicateClusters, products, canonicalProducts, openCommandPalette } = useApp();

  const pendingMatchesCount = matchPairs.filter((m) => m.matchStatus === 'Pending Review').length;
  const activeDuplicateClusters = duplicateClusters.filter((c) => c.status === 'Active Redundancy').length;

  const sections: NavSection[] = [
    {
      title: 'PLATFORM OVERVIEW',
      items: [
        {
          id: 'landing',
          label: 'Landing & Architecture',
          icon: Home,
          description: 'Entity resolution pipeline overview'
        },
        {
          id: 'dashboard',
          label: 'Executive Dashboard',
          icon: LayoutDashboard,
          badge: 'Live',
          badgeColor: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
          description: 'KPIs, match rates, & catalog telemetry'
        }
      ]
    },
    {
      title: 'DATA INGESTION & CATALOG',
      items: [
        {
          id: 'upload',
          label: 'Product Upload & Pipeline',
          icon: UploadCloud,
          badge: 'CSV/JSON',
          badgeColor: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
          description: 'Batch ingest & normalize feeds'
        },
        {
          id: 'catalog',
          label: 'Master Product Catalog',
          icon: Layers,
          badge: products.length,
          badgeColor: 'bg-slate-500/10 text-slate-500 border border-slate-500/20',
          description: 'Search & filter unified catalog'
        }
      ]
    },
    {
      title: 'RESOLUTION & MATCHING',
      items: [
        {
          id: 'matching',
          label: 'Product Matching Engine',
          icon: GitMerge,
          badge: pendingMatchesCount > 0 ? `${pendingMatchesCount} Pending` : 'Optimal',
          badgeColor:
            pendingMatchesCount > 0
              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-500',
          description: 'Side-by-side verification & merge'
        },
        {
          id: 'canonical',
          label: 'Canonical Product 360°',
          icon: Sparkles,
          badge: `${canonicalProducts.length} Masters`,
          badgeColor: 'bg-purple-500/10 text-purple-500 border border-purple-500/20',
          description: 'Unified listing with all sellers'
        },
        {
          id: 'price-comparison',
          label: 'Price Intelligence',
          icon: IndianRupee,
          badge: 'Buy-Box',
          badgeColor: 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20',
          description: 'Cross-seller price dispersion'
        },
        {
          id: 'duplicate-detection',
          label: 'Duplicate Detection',
          icon: CopyX,
          badge: activeDuplicateClusters > 0 ? `${activeDuplicateClusters} Redundant` : 'Clean',
          badgeColor:
            activeDuplicateClusters > 0
              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-500',
          description: 'Cluster deduplication workbench'
        }
      ]
    },
    {
      title: 'INTELLIGENCE & ADMIN',
      items: [
        {
          id: 'analytics',
          label: 'Matching & Latency Analytics',
          icon: BarChart3,
          description: 'LSH buckets, Jaccard & TF-IDF metrics'
        },
        {
          id: 'admin',
          label: 'Admin & Feed Governance',
          icon: ShieldCheck,
          badge: '5 Connectors',
          badgeColor: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
          description: 'API connectors, RBAC & audit logs'
        }
      ]
    }
  ];

  const handleNavClick = (id: PageId) => {
    navigateTo(id);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          id="sidebar-backdrop"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        id="app-main-sidebar"
        className={`fixed top-16 bottom-0 left-0 z-40 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {/* Command Palette Quick Launcher */}
          <div>
            <button
              id="sidebar-command-palette-btn"
              type="button"
              onClick={() => {
                openCommandPalette();
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium bg-slate-100/90 dark:bg-slate-800/80 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 border border-slate-200/80 dark:border-slate-700/80 hover:border-purple-500/40 transition-all shadow-2xs group"
            >
              <div className="flex items-center gap-2">
                <Command className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span className="font-semibold">Command Palette</span>
              </div>
              <kbd className="px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[10px] text-slate-500 dark:text-slate-400 shadow-2xs">
                Ctrl K
              </kbd>
            </button>
          </div>

          {sections.map((section) => (
            <div key={section.title} className="space-y-1">
              <h4 className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 px-3 uppercase mb-2">
                {section.title}
              </h4>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;

                  return (
                    <button
                      key={item.id}
                      id={`nav-link-${item.id}`}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/20 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-1.5 rounded-lg transition-colors ${
                            isActive
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'text-slate-500 dark:text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 bg-slate-100 dark:bg-slate-800'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <span className="truncate block leading-tight">{item.label}</span>
                          <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 truncate block">
                            {item.description}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {item.badge && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                              item.badgeColor || 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform ${
                            isActive
                              ? 'text-purple-600 dark:text-purple-400 translate-x-0.5'
                              : 'text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Engine Telemetry Card */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-900/10 via-purple-900/10 to-indigo-900/10 border border-purple-500/20 dark:border-purple-500/30">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                <Cpu className="w-3.5 h-3.5 text-purple-500" />
                Cluster Ingest Engine
              </span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                99.4% F1
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
              LSH Blocking + Normalized Vector Cosine Similarity
            </p>
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-1.5 rounded-full w-[94%]" />
            </div>
            <div className="flex justify-between items-center text-[9px] text-slate-400 mt-1 font-mono">
              <span>Latency: 57.2ms</span>
              <span>Memory: 4.8 GB</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
