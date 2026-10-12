import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ProductItem } from '../../types';
import {
  Search,
  Filter,
  Grid,
  List,
  Star,
  Sparkles,
  Layers,
  ArrowUpDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  IndianRupee
} from 'lucide-react';

export const CatalogPage: React.FC = () => {
  const { products, navigateTo, quickSearchQuery, setQuickSearchQuery } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'price-asc' | 'price-desc' | 'rating' | 'score'>('relevance');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const itemsPerPage = 6;

  // Extract unique categories & brands dynamically
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand) set.add(p.brand);
    });
    return Array.from(set);
  }, [products]);

  // Filter & Sort
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const query = quickSearchQuery.toLowerCase().trim();
        const matchesQuery =
          !query ||
          p.title.toLowerCase().includes(query) ||
          p.brand.toLowerCase().includes(query) ||
          p.modelNumber.toLowerCase().includes(query) ||
          p.upcOrGtin.includes(query);

        const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
        const matchesBrand = selectedBrand === 'all' || p.brand === selectedBrand;
        const matchesStatus =
          selectedStatus === 'all' ||
          (selectedStatus === 'canonical' && p.status === 'Canonical Master') ||
          (selectedStatus === 'pending' && p.status === 'Duplicate Pending');

        return matchesQuery && matchesCat && matchesBrand && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'rating') return b.rating - a.rating;
        if (sortBy === 'score') return (b.matchScore || 0) - (a.matchScore || 0);
        return 0; // relevance
      });
  }, [products, quickSearchQuery, selectedCategory, selectedBrand, selectedStatus, sortBy]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPageNum - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPageNum]);

  return (
    <div id="catalog-page-container" className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Unified Master Catalog
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            Product Catalog & Canonical Records
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Browse normalized master entities, multi-seller aggregations, and SKU attributes across retail feeds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              aria-label="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar Strip */}
      <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, brand, MPN, UPC..."
              value={quickSearchQuery}
              onChange={(e) => {
                setQuickSearchQuery(e.target.value);
                setCurrentPageNum(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPageNum(1);
              }}
              className="w-full py-2 px-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-purple-500"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Brand Filter */}
          <div>
            <select
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setCurrentPageNum(1);
              }}
              className="w-full py-2 px-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-purple-500"
            >
              <option value="all">All Brands ({brands.length})</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-purple-500"
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="score">Sort: Match Score (High-to-Low)</option>
              <option value="price-asc">Sort: Price (Low to High)</option>
              <option value="price-desc">Sort: Price (High to Low)</option>
              <option value="rating">Sort: Highest Rated</option>
            </select>
          </div>
        </div>

        {/* Quick status chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <span className="text-slate-400 text-[11px] font-semibold">Entity State:</span>
          <button
            onClick={() => {
              setSelectedStatus('all');
              setCurrentPageNum(1);
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
              selectedStatus === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            All Products ({products.length})
          </button>
          <button
            onClick={() => {
              setSelectedStatus('canonical');
              setCurrentPageNum(1);
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
              selectedStatus === 'canonical'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Canonical Masters ({products.filter((p) => p.status === 'Canonical Master').length})
          </button>
          <button
            onClick={() => {
              setSelectedStatus('pending');
              setCurrentPageNum(1);
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
              selectedStatus === 'pending'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Pending Resolution ({products.filter((p) => p.status === 'Duplicate Pending').length})
          </button>

          <span className="ml-auto text-[11px] text-slate-500">
            Showing {filteredProducts.length} matching products
          </span>
        </div>
      </div>

      {/* Product Display: Grid or List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedProducts.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden flex flex-col justify-between hover:border-purple-500/40 hover:shadow-lg transition-all group"
            >
              <div>
                {/* Image Banner */}
                <div className="relative h-48 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                    {p.status === 'Canonical Master' ? (
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-600 text-white shadow-xs">
                        Canonical Master
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                        Duplicate Candidate
                      </span>
                    )}
                    {p.sellerOffers && p.sellerOffers.length > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                        {p.sellerOffers.length} Sellers
                      </span>
                    )}
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/90 dark:bg-slate-900/90 text-purple-600 dark:text-purple-400 shadow-xs border border-purple-200 dark:border-purple-800">
                      Match: {p.matchScore || 98.4}%
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider text-[10px]">
                      {p.category}
                    </span>
                    <span className="font-mono text-[10px]">UPC: {p.upcOrGtin}</span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug">
                    {p.title}
                  </h3>

                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1 text-amber-500 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{p.rating}</span>
                    </div>
                    <span className="text-slate-400">({p.reviewsCount.toLocaleString()} reviews)</span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="text-slate-500 font-medium">Brand: {p.brand}</span>
                  </div>

                  {/* Attributes chip row */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Object.entries(p.attributes)
                      .slice(0, 3)
                      .map(([key, val], i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-medium truncate max-w-[140px]"
                        >
                          {key}: {val}
                        </span>
                      ))}
                  </div>
                </div>
              </div>

              {/* Bottom Price & Action Footer */}
              <div className="p-5 pt-0">
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Best Price</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">
                      {p.currency}
                      {p.price.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {p.status === 'Canonical Master' ? (
                      <button
                        onClick={() => navigateTo('canonical', { canonicalId: p.canonicalId || 'can-001' })}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors flex items-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Canonical 360°</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => navigateTo('matching')}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors flex items-center gap-1"
                      >
                        <span>Resolve Match</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedProducts.map((p) => (
              <div
                key={p.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300">
                        {p.status}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">MPN: {p.modelNumber}</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500 font-semibold">{p.brand}</span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                      {p.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-1">
                      Category: {p.category} | UPC: {p.upcOrGtin} | Match Confidence: {p.matchScore || 98.4}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 sm:pl-4 sm:border-l border-slate-100 dark:border-slate-800">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-medium">Best Price</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">
                      {p.currency}
                      {p.price.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <button
                    onClick={() => navigateTo('canonical', { canonicalId: p.canonicalId || 'can-001' })}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <span>View 360°</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex items-center justify-between text-xs">
        <span className="text-slate-500">
          Page <span className="font-bold text-slate-800 dark:text-slate-200">{currentPageNum}</span> of{' '}
          <span className="font-bold text-slate-800 dark:text-slate-200">{totalPages}</span>
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPageNum((p) => Math.max(1, p - 1))}
            disabled={currentPageNum === 1}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              onClick={() => setCurrentPageNum(num)}
              className={`w-8 h-8 rounded-xl font-semibold transition-colors ${
                currentPageNum === num
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {num}
            </button>
          ))}

          <button
            onClick={() => setCurrentPageNum((p) => Math.min(totalPages, p + 1))}
            disabled={currentPageNum === totalPages}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
