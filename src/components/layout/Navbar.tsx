import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Layers,
  Search,
  Sun,
  Moon,
  Bell,
  Menu,
  X,
  UploadCloud,
  Cpu,
  ChevronDown,
  Command
} from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';

export const Navbar: React.FC<{ onToggleSidebar?: () => void; isSidebarOpen?: boolean }> = ({
  onToggleSidebar,
  isSidebarOpen
}) => {
  const {
    isDarkMode,
    toggleDarkMode,
    currentPage,
    navigateTo,
    notifications,
    quickSearchQuery,
    setQuickSearchQuery,
    products,
    openCommandPalette
  } = useApp();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearchQuery.trim()) {
      navigateTo('catalog');
    }
  };

  const getPageTitle = (page: string) => {
    switch (page) {
      case 'landing':
        return 'Overview & Architecture';
      case 'dashboard':
        return 'Resolution Intelligence Dashboard';
      case 'upload':
        return 'Multi-Source Product Ingestion';
      case 'catalog':
        return 'Master Product Catalog';
      case 'matching':
        return 'Entity Matching & Verification';
      case 'canonical':
        return 'Canonical Product 360°';
      case 'price-comparison':
        return 'Cross-Seller Price Intelligence';
      case 'duplicate-detection':
        return 'Catalog Deduplication Workbench';
      case 'analytics':
        return 'Algorithms & Latency Analytics';
      case 'admin':
        return 'Platform Governance & Feeds';
      default:
        return 'Enterprise Platform';
    }
  };

  return (
    <>
      <header
        id="app-main-navbar"
        className="sticky top-0 z-30 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Left: Mobile sidebar toggle + Brand */}
          <div className="flex items-center gap-3">
            <button
              id="sidebar-toggle-btn"
              onClick={onToggleSidebar}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden transition-colors"
              aria-label="Toggle navigation drawer"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <button
              id="navbar-brand-btn"
              onClick={() => navigateTo('landing')}
              className="flex items-center gap-2.5 group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-0.5 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform flex items-center justify-center">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                  <Layers className="w-5 h-5 text-purple-400 group-hover:rotate-12 transition-transform" />
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-300 dark:to-purple-400 bg-clip-text text-transparent">
                    EntiMatch
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Enterprise
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[200px]">
                  Product Entity Resolution
                </p>
              </div>
            </button>

            {/* Current Page Breadcrumb / Status */}
            <div className="hidden xl:flex items-center gap-2 pl-3 ml-2 border-l border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {getPageTitle(currentPage)}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LSH Engine Active
              </span>
            </div>
          </div>

          {/* Center: Search & Command Palette Trigger */}
          <div className="flex-1 max-w-md mx-2">
            <button
              id="navbar-command-palette-trigger"
              type="button"
              onClick={openCommandPalette}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 hover:bg-white dark:hover:bg-slate-900 hover:border-purple-500/50 dark:hover:border-purple-500/50 hover:shadow-xs transition-all text-left group"
            >
              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                <Search className="w-4 h-4 shrink-0" />
                <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 truncate">
                  Search products, sections, or actions...
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700 shadow-2xs group-hover:border-purple-400 dark:group-hover:border-purple-600 transition-colors">
                  <Command className="w-3 h-3" />
                  <span>K</span>
                </kbd>
              </div>
            </button>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Quick Upload Button */}
            <button
              id="navbar-quick-upload-btn"
              onClick={() => navigateTo('upload')}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/20 transition-all hover:shadow-md"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Ingest Catalog</span>
            </button>

            {/* Notifications Button */}
            <div className="relative">
              <button
                id="navbar-notifications-btn"
                onClick={() => setIsNotifOpen((prev) => !prev)}
                className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Open notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifs > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                    {unreadNotifs}
                  </span>
                )}
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <button
              id="theme-toggle-btn"
              onClick={toggleDarkMode}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle color theme"
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600" />
              )}
            </button>

            {/* User Profile Pill */}
            <button
              id="navbar-user-profile-btn"
              onClick={() => navigateTo('admin')}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-500 text-white font-semibold text-xs flex items-center justify-center ring-2 ring-purple-500/30">
                AR
              </div>
              <div className="hidden lg:block text-left text-xs leading-tight">
                <p className="font-semibold text-slate-800 dark:text-slate-200">Alex Rivera</p>
                <p className="text-[10px] text-slate-400">Principal Ops</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden lg:block" />
            </button>
          </div>
        </div>
      </header>

      <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </>
  );
};
