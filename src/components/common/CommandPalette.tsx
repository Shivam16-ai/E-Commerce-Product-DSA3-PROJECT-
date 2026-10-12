import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { PageId, ProductItem } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  X,
  Sparkles,
  Layers,
  LayoutDashboard,
  UploadCloud,
  GitMerge,
  IndianRupee,
  CopyX,
  BarChart3,
  ShieldCheck,
  Home,
  Sun,
  Moon,
  Download,
  RefreshCw,
  CheckCircle2,
  Tag,
  ArrowRight,
  ExternalLink,
  Store,
  Sliders,
  Bell,
  Cpu,
  CornerDownLeft,
  FileSpreadsheet,
  FileCode
} from 'lucide-react';

type PaletteFilter = 'all' | 'navigation' | 'products' | 'actions';

interface CommandItem {
  id: string;
  type: 'navigation' | 'action' | 'product';
  title: string;
  subtitle?: string;
  category?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  product?: ProductItem;
  shortcut?: string;
  perform: () => void;
}

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    closeCommandPalette,
    navigateTo,
    currentPage,
    isDarkMode,
    toggleDarkMode,
    products,
    canonicalProducts,
    setSelectedCanonicalId,
    addToast,
    clearAllNotifications
  } = useApp();

  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<PaletteFilter>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when palette opens and reset query
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setActiveFilter('all');
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isCommandPaletteOpen]);

  // Export catalog helpers
  const handleExportJSON = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(products, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `entimatch_catalog_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      addToast('Catalog Exported', `Exported ${products.length} catalog items as JSON file.`, 'success');
    } catch {
      addToast('Export Failed', 'Unable to initiate file download.', 'error');
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ['id', 'title', 'brand', 'modelNumber', 'category', 'price', 'currency', 'upcOrGtin', 'status', 'source'];
      const rows = products.map((p) => [
        p.id,
        `"${(p.title || '').replace(/"/g, '""')}"`,
        `"${p.brand || ''}"`,
        `"${p.modelNumber || ''}"`,
        `"${p.category || ''}"`,
        p.price,
        p.currency,
        `"${p.upcOrGtin || ''}"`,
        `"${p.status || ''}"`,
        `"${p.source || ''}"`
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `entimatch_catalog_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      addToast('Catalog Exported', `Exported ${products.length} catalog items as CSV file.`, 'success');
    } catch {
      addToast('Export Failed', 'Unable to initiate file download.', 'error');
    }
  };

  // Build command items list
  const allCommands = useMemo<CommandItem[]>(() => {
    const navItems: CommandItem[] = [
      {
        id: 'nav-dashboard',
        type: 'navigation',
        title: 'Executive Analytics Dashboard',
        subtitle: 'KPIs, match rates, confidence distribution, & ingestion velocity',
        category: 'Navigation',
        icon: LayoutDashboard,
        badge: 'Live KPIs',
        badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300',
        shortcut: 'G D',
        perform: () => {
          navigateTo('dashboard');
          closeCommandPalette();
        }
      },
      {
        id: 'nav-upload',
        type: 'navigation',
        title: 'Multi-Source Product Ingestion',
        subtitle: 'Upload CSV/JSON feeds, trigger LSH MinHash tokenizer',
        category: 'Navigation',
        icon: UploadCloud,
        badge: 'Ingest Feed',
        badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300',
        shortcut: 'G U',
        perform: () => {
          navigateTo('upload');
          closeCommandPalette();
        }
      },
      {
        id: 'nav-catalog',
        type: 'navigation',
        title: 'Master Product Catalog',
        subtitle: 'Search, filter, and inspect multi-seller consolidated catalog',
        category: 'Navigation',
        icon: Layers,
        badge: `${products.length} SKUs`,
        badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        shortcut: 'G C',
        perform: () => {
          navigateTo('catalog');
          closeCommandPalette();
        }
      },
      {
        id: 'nav-matching',
        type: 'navigation',
        title: 'Entity Matching & Verification Workbench',
        subtitle: 'Side-by-side pair verification, attribute Jaccard, pHash scores',
        category: 'Navigation',
        icon: GitMerge,
        badge: 'Resolve Pairs',
        badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300',
        shortcut: 'G M',
        perform: () => {
          navigateTo('matching');
          closeCommandPalette();
        }
      },
      {
        id: 'nav-canonical',
        type: 'navigation',
        title: 'Canonical Product 360° View',
        subtitle: 'Unified master record, multi-seller buy box, and spec matrix',
        category: 'Navigation',
        icon: Sparkles,
        badge: `${canonicalProducts.length} Masters`,
        badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300',
        shortcut: 'G P',
        perform: () => {
          navigateTo('canonical');
          closeCommandPalette();
        }
      },
      {
        id: 'nav-price',
        type: 'navigation',
        title: 'Cross-Seller Price Intelligence',
        subtitle: 'Arbitrage detection, price dispersion, and Buy-Box analysis',
        category: 'Navigation',
        icon: IndianRupee,
        badge: 'Buy-Box',
        badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300',
        shortcut: 'G B',
        perform: () => {
          navigateTo('price-comparison');
          closeCommandPalette();
        }
      },
      {
        id: 'nav-duplicates',
        type: 'navigation',
        title: 'Catalog Deduplication Workbench',
        subtitle: 'Identical product clusters, ad-waste cannibalization, & 1-click merge',
        category: 'Navigation',
        icon: CopyX,
        badge: 'Deduplicate',
        badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300',
        shortcut: 'G X',
        perform: () => {
          navigateTo('duplicate-detection');
          closeCommandPalette();
        }
      },
      {
        id: 'nav-analytics',
        type: 'navigation',
        title: 'Matching & Latency Analytics',
        subtitle: 'LSH blocking reduction, stage latency breakdown, TF-IDF stats',
        category: 'Navigation',
        icon: BarChart3,
        badge: 'Telemetry',
        badgeColor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/80 dark:text-cyan-300',
        shortcut: 'G A',
        perform: () => {
          navigateTo('analytics');
          closeCommandPalette();
        }
      },
      {
        id: 'nav-admin',
        type: 'navigation',
        title: 'Admin & Feed Governance',
        subtitle: 'Similarity weights matrix, retail feed connectors, & audit trails',
        category: 'Navigation',
        icon: ShieldCheck,
        badge: 'Control Plane',
        badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300',
        shortcut: 'G S',
        perform: () => {
          navigateTo('admin');
          closeCommandPalette();
        }
      },
      {
        id: 'nav-landing',
        type: 'navigation',
        title: 'Platform Overview & Architecture Simulator',
        subtitle: 'Interactive MinHash LSH token simulation & benchmark specs',
        category: 'Navigation',
        icon: Home,
        shortcut: 'G H',
        perform: () => {
          navigateTo('landing');
          closeCommandPalette();
        }
      }
    ];

    const actionItems: CommandItem[] = [
      {
        id: 'act-upload',
        type: 'action',
        title: 'Upload File / Batch Ingest Products',
        subtitle: 'Drop CSV, JSON, or Excel feeds directly into the entity resolution queue',
        category: 'Actions',
        icon: UploadCloud,
        badge: 'Action',
        badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300',
        perform: () => {
          navigateTo('upload');
          closeCommandPalette();
          addToast('Ready to Ingest', 'Select or drop your catalog CSV or JSON feed.', 'info');
        }
      },
      {
        id: 'act-analytics',
        type: 'action',
        title: 'View Resolution Analytics & Pipeline Latency',
        subtitle: 'Examine candidate reduction percentage, latency budgets, and F1 curve',
        category: 'Actions',
        icon: BarChart3,
        badge: 'Action',
        badgeColor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/80 dark:text-cyan-300',
        perform: () => {
          navigateTo('analytics');
          closeCommandPalette();
        }
      },
      {
        id: 'act-export-json',
        type: 'action',
        title: 'Export Full Master Catalog (JSON)',
        subtitle: 'Download complete structured catalog with attributes, offers, and hashes',
        category: 'Actions',
        icon: FileCode,
        badge: '.json',
        badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300',
        perform: () => {
          closeCommandPalette();
          handleExportJSON();
        }
      },
      {
        id: 'act-export-csv',
        type: 'action',
        title: 'Export Master Catalog Table (CSV)',
        subtitle: 'Export spreadsheet-ready CSV with GTIN, Brand, Model, and Price',
        category: 'Actions',
        icon: FileSpreadsheet,
        badge: '.csv',
        badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300',
        perform: () => {
          closeCommandPalette();
          handleExportCSV();
        }
      },
      {
        id: 'act-theme',
        type: 'action',
        title: isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme',
        subtitle: `Currently in ${isDarkMode ? 'Dark' : 'Light'} appearance mode`,
        category: 'Actions',
        icon: isDarkMode ? Sun : Moon,
        badge: 'Theme',
        badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300',
        perform: () => {
          toggleDarkMode();
          addToast('Theme Updated', `Switched to ${!isDarkMode ? 'Dark' : 'Light'} mode.`, 'info');
          closeCommandPalette();
        }
      },
      {
        id: 'act-flush',
        type: 'action',
        title: 'Flush Ingestion Cache & Sync Clusters',
        subtitle: 'Invalidate stale worker cache and force re-evaluation of candidate pairs',
        category: 'Actions',
        icon: RefreshCw,
        badge: 'System',
        badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        perform: () => {
          closeCommandPalette();
          addToast('Global Cache Flushed', 'Worker nodes synchronized with latest catalog state.', 'success');
        }
      },
      {
        id: 'act-clear-notifs',
        type: 'action',
        title: 'Mark All System Notifications Read',
        subtitle: 'Clear alert badges and dismiss outstanding resolution notifications',
        category: 'Actions',
        icon: Bell,
        badge: 'Notifications',
        badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        perform: () => {
          clearAllNotifications();
          closeCommandPalette();
        }
      },
      {
        id: 'act-calibrate-weights',
        type: 'action',
        title: 'Calibrate Similarity Algorithm Weights',
        subtitle: 'Adjust ensemble weights for Title N-grams, Brand exactness, and pHash',
        category: 'Actions',
        icon: Sliders,
        badge: 'Weights',
        badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300',
        perform: () => {
          navigateTo('admin');
          closeCommandPalette();
        }
      }
    ];

    const productItems: CommandItem[] = products.map((prod) => ({
      id: `prod-${prod.id}`,
      type: 'product',
      title: prod.title,
      subtitle: `${prod.brand} • ${prod.category} • Model: ${prod.modelNumber} • GTIN: ${prod.upcOrGtin}`,
      category: 'Products',
      icon: Sparkles,
      badge: `₹${prod.price.toLocaleString('en-IN')}`,
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300',
      product: prod,
      perform: () => {
        setSelectedCanonicalId(prod.canonicalId || prod.id);
        navigateTo('canonical');
        closeCommandPalette();
        addToast('Product Opened', `Viewing Canonical 360° for "${prod.title.substring(0, 35)}..."`, 'info');
      }
    }));

    return [...actionItems, ...navItems, ...productItems];
  }, [products, canonicalProducts, isDarkMode, navigateTo, closeCommandPalette, toggleDarkMode, setSelectedCanonicalId, addToast, clearAllNotifications]);

  // Filter commands based on search query and active category tab
  const filteredCommands = useMemo(() => {
    const cleanQuery = query.toLowerCase().trim();

    return allCommands.filter((cmd) => {
      // Tab filter
      if (activeFilter === 'navigation' && cmd.type !== 'navigation') return false;
      if (activeFilter === 'actions' && cmd.type !== 'action') return false;
      if (activeFilter === 'products' && cmd.type !== 'product') return false;

      // Query filter
      if (!cleanQuery) {
        // When query is empty and 'all' is selected, show actions & nav first, plus top canonical products
        if (activeFilter === 'all') {
          if (cmd.type === 'product') {
            return cmd.product?.status === 'Canonical Master';
          }
          return true;
        }
        return true;
      }

      // Matching query
      const matchTitle = cmd.title.toLowerCase().includes(cleanQuery);
      const matchSubtitle = cmd.subtitle?.toLowerCase().includes(cleanQuery);
      const matchCategory = cmd.category?.toLowerCase().includes(cleanQuery);

      let matchProductProps = false;
      if (cmd.product) {
        matchProductProps =
          cmd.product.brand.toLowerCase().includes(cleanQuery) ||
          cmd.product.modelNumber.toLowerCase().includes(cleanQuery) ||
          cmd.product.upcOrGtin.toLowerCase().includes(cleanQuery) ||
          cmd.product.source.toLowerCase().includes(cleanQuery) ||
          cmd.product.sourceSku.toLowerCase().includes(cleanQuery) ||
          Object.values(cmd.product.attributes || {}).some((v) =>
            v.toLowerCase().includes(cleanQuery)
          );
      }

      return matchTitle || matchSubtitle || matchCategory || matchProductProps;
    });
  }, [allCommands, query, activeFilter]);

  // Keep selectedIndex in bounds
  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, selectedIndex]);

  // Handle keyboard navigation inside command palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].perform();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCommandPalette();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const tabs: PaletteFilter[] = ['all', 'navigation', 'products', 'actions'];
      const currentIdx = tabs.indexOf(activeFilter);
      const nextIdx = e.shiftKey
        ? (currentIdx - 1 + tabs.length) % tabs.length
        : (currentIdx + 1) % tabs.length;
      setActiveFilter(tabs[nextIdx]);
      setSelectedIndex(0);
    }
  };

  // Auto-scroll selected item into view
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;
    const activeItemEl = listEl.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    if (activeItemEl) {
      activeItemEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isCommandPaletteOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="command-palette-backdrop"
        className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-md transition-all"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            closeCommandPalette();
          }
        }}
      >
        <motion.div
          id="command-palette-modal"
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
          onKeyDown={handleKeyDown}
        >
          {/* Top Search Input Box */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Search className="w-5 h-5 shrink-0" />
            </div>

            <input
              id="command-palette-input"
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Type a command, search products, sections, or actions..."
              className="w-full bg-transparent text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden font-medium"
            />

            {query && (
              <button
                id="command-palette-clear-btn"
                type="button"
                onClick={() => {
                  setQuery('');
                  setSelectedIndex(0);
                  inputRef.current?.focus();
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              id="command-palette-close-btn"
              type="button"
              onClick={closeCommandPalette}
              className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
            >
              <span>Esc</span>
            </button>
          </div>

          {/* Filter Tabs Strip */}
          <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline mr-1">
              Filter:
            </span>

            <button
              type="button"
              onClick={() => {
                setActiveFilter('all');
                setSelectedIndex(0);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
                activeFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>All Results</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveFilter('navigation');
                setSelectedIndex(0);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
                activeFilter === 'navigation'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-3 h-3" />
              <span>Navigation</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveFilter('products');
                setSelectedIndex(0);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
                activeFilter === 'products'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Products ({products.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveFilter('actions');
                setSelectedIndex(0);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
                activeFilter === 'actions'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Cpu className="w-3 h-3" />
              <span>Actions & Tools</span>
            </button>

            <div className="ml-auto text-[11px] text-slate-400 hidden sm:block font-mono">
              {filteredCommands.length} match{filteredCommands.length === 1 ? '' : 'es'}
            </div>
          </div>

          {/* Results List */}
          <div
            id="command-palette-results-list"
            ref={listRef}
            className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/40"
          >
            {filteredCommands.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center">
                  <Search className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No results found for &ldquo;{query}&rdquo;
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Try searching for common commands like <span className="font-semibold text-purple-600 dark:text-purple-400">&ldquo;Upload&rdquo;</span>, <span className="font-semibold text-purple-600 dark:text-purple-400">&ldquo;Analytics&rdquo;</span>, <span className="font-semibold text-purple-600 dark:text-purple-400">&ldquo;Apple&rdquo;</span>, or <span className="font-semibold text-purple-600 dark:text-purple-400">&ldquo;Sony&rdquo;</span>.
                  </p>
                </div>
              </div>
            ) : (
              filteredCommands.map((cmd, idx) => {
                const Icon = cmd.icon;
                const isSelected = idx === selectedIndex;
                const isProduct = cmd.type === 'product';

                return (
                  <div
                    key={cmd.id}
                    data-index={idx}
                    onClick={() => cmd.perform()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`pt-1 first:pt-0 cursor-pointer rounded-xl transition-all ${
                      isSelected
                        ? 'bg-purple-50/80 dark:bg-purple-950/40 border-l-4 border-purple-600 pl-3 pr-3 py-2.5 shadow-xs'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 px-3 py-2.5 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Product Thumbnail or Type Icon */}
                      {isProduct && cmd.product?.imageUrl ? (
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 shrink-0 overflow-hidden flex items-center justify-center">
                          <img
                            src={cmd.product.imageUrl}
                            alt={cmd.product.title}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                      )}

                      {/* Title & Subtitle */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs sm:text-sm font-bold truncate ${
                              isSelected
                                ? 'text-purple-900 dark:text-purple-200'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {cmd.title}
                          </span>

                          {cmd.badge && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                cmd.badgeColor ||
                                'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {cmd.badge}
                            </span>
                          )}

                          {isProduct && cmd.product && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase tracking-wider shrink-0 ${
                                cmd.product.status === 'Canonical Master'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                              }`}
                            >
                              {cmd.product.status === 'Canonical Master' ? 'Master' : 'Matched'}
                            </span>
                          )}
                        </div>

                        {cmd.subtitle && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {cmd.subtitle}
                          </p>
                        )}
                      </div>

                      {/* Right indicator */}
                      <div className="flex items-center gap-2 shrink-0">
                        {cmd.shortcut && (
                          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            {cmd.shortcut}
                          </kbd>
                        )}

                        {isSelected ? (
                          <div className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-100/80 dark:bg-purple-900/40 px-2 py-1 rounded-lg">
                            <span className="hidden sm:inline">Select</span>
                            <CornerDownLeft className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Footer with Keyboard Hints */}
          <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-bold shadow-2xs">
                  ↑
                </kbd>
                <kbd className="px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-bold shadow-2xs">
                  ↓
                </kbd>
                <span className="ml-0.5">Navigate</span>
              </span>

              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-bold shadow-2xs">
                  ↵
                </kbd>
                <span className="ml-0.5">Execute</span>
              </span>

              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-bold shadow-2xs">
                  Tab
                </kbd>
                <span className="ml-0.5">Switch Filter</span>
              </span>

              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-bold shadow-2xs">
                  Esc
                </kbd>
                <span className="ml-0.5">Exit</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 font-medium text-slate-400">
              <span>Quick launcher:</span>
              <kbd className="px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-mono font-bold text-[10px]">
                Ctrl + K
              </kbd>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
