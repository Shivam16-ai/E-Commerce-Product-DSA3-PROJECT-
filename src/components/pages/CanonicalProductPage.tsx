import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  Store,
  Star,
  Truck,
  ExternalLink,
  ChevronDown,
  CheckCircle2,
  TrendingDown,
  Tag,
  IndianRupee,
  Layers,
  ArrowRight,
  GitMerge,
  Split,
  Plus,
  Trash2,
  AlertTriangle,
  RotateCcw,
  History,
  Search,
  X,
  ShieldAlert,
  ArrowUpRight,
  Check,
  Filter
} from 'lucide-react';
import { SellerOffer, CanonicalProduct } from '../../types';
import { getCanonicalSources, getCanonicalHistory } from '../../lib/api';

export const CanonicalProductPage: React.FC = () => {
  const {
    canonicalProducts,
    canonicalRecords,
    products,
    selectedCanonicalId,
    setSelectedCanonicalId,
    mergeCanonicalEntities,
    splitCanonicalEntity,
    undoMergeEntity,
    attachSourceListing,
    detachSourceListing,
    navigateTo
  } = useApp();

  // Combine canonical records from backend with fallback
  const masterEntities: any[] = useMemo(() => {
    if (canonicalRecords && canonicalRecords.length > 0) {
      return canonicalRecords;
    }
    return canonicalProducts;
  }, [canonicalRecords, canonicalProducts]);

  // Search & filter state for entity switcher
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'merged'>('all');

  const filteredEntities = useMemo(() => {
    return masterEntities.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.modelNumber && p.modelNumber.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q)) ||
        ((p as any).canonicalId && (p as any).canonicalId.toLowerCase().includes(q));

      const status = p.status || 'active';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && status !== 'merged') ||
        (statusFilter === 'merged' && status === 'merged');

      return matchesQuery && matchesStatus;
    });
  }, [masterEntities, searchQuery, statusFilter]);

  const currentProduct = useMemo(() => {
    const found = masterEntities.find(
      (p) => (p.id || (p as any).canonicalId) === selectedCanonicalId
    );
    return found || masterEntities[0];
  }, [masterEntities, selectedCanonicalId]);

  const currentCanonicalId = currentProduct ? currentProduct.id || (currentProduct as any).canonicalId : '';

  // Attached sources state
  const [attachedSources, setAttachedSources] = useState<any[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);

  // Entity Audit history state
  const [entityHistory, setEntityHistory] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Merge modal state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [mergeReason, setMergeReason] = useState<string>('');
  const [confirmConflicts, setConfirmConflicts] = useState<boolean>(false);
  const [mergeLoading, setMergeLoading] = useState<boolean>(false);

  // Split modal state
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitSelectedSources, setSplitSelectedSources] = useState<string[]>([]);
  const [splitNewTitle, setSplitNewTitle] = useState<string>('');
  const [splitReason, setSplitReason] = useState<string>('');
  const [splitLoading, setSplitLoading] = useState<boolean>(false);

  // Attach modal state
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [selectedAttachSourceId, setSelectedAttachSourceId] = useState<string>('');
  const [attachReason, setAttachReason] = useState<string>('');
  const [attachLoading, setAttachLoading] = useState<boolean>(false);

  // Fetch attached sources whenever selected canonical product changes
  useEffect(() => {
    if (!currentCanonicalId) return;
    let active = true;
    setLoadingSources(true);

    getCanonicalSources(currentCanonicalId)
      .then((res) => {
        if (active) {
          if (res && Array.isArray(res.items)) {
            setAttachedSources(res.items);
          } else {
            // fallback to matching products in local state
            const sourceIds = currentProduct?.sourceProductIds || [];
            const matches = products.filter((p) => sourceIds.includes(p.id) || (p as any).canonicalId === currentCanonicalId);
            setAttachedSources(matches);
          }
        }
      })
      .catch(() => {
        if (active) {
          const sourceIds = currentProduct?.sourceProductIds || [];
          const matches = products.filter((p) => sourceIds.includes(p.id) || (p as any).canonicalId === currentCanonicalId);
          setAttachedSources(matches);
        }
      })
      .finally(() => {
        if (active) setLoadingSources(false);
      });

    return () => {
      active = false;
    };
  }, [currentCanonicalId, currentProduct, products]);

  // Load audit history when toggled
  const handleOpenHistory = async () => {
    if (!currentCanonicalId) return;
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const res = await getCanonicalHistory(currentCanonicalId);
      if (res && Array.isArray(res.items)) {
        setEntityHistory(res.items);
      }
    } catch (err) {
      console.error('Failed to load entity history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Conflict analysis between currentProduct and mergeTarget
  const targetMergeProduct = useMemo(() => {
    return masterEntities.find((p) => (p.id || (p as any).canonicalId) === mergeTargetId);
  }, [masterEntities, mergeTargetId]);

  const mergeConflicts = useMemo(() => {
    if (!currentProduct || !targetMergeProduct) return [];
    const list: string[] = [];

    const norm = (s: string) => (s || '').trim().toLowerCase();

    if (norm(currentProduct.brand) !== norm(targetMergeProduct.brand)) {
      list.push(`Brand Mismatch: "${currentProduct.brand}" vs "${targetMergeProduct.brand}"`);
    }
    if (norm(currentProduct.category) !== norm(targetMergeProduct.category)) {
      list.push(`Category Mismatch: "${currentProduct.category}" vs "${targetMergeProduct.category}"`);
    }
    if (
      currentProduct.modelNumber &&
      targetMergeProduct.modelNumber &&
      norm(currentProduct.modelNumber) !== norm(targetMergeProduct.modelNumber)
    ) {
      list.push(`Model Number Divergence: "${currentProduct.modelNumber}" vs "${targetMergeProduct.modelNumber}"`);
    }
    if (
      currentProduct.upcOrGtin &&
      targetMergeProduct.upcOrGtin &&
      norm(currentProduct.upcOrGtin) !== norm(targetMergeProduct.upcOrGtin)
    ) {
      list.push(`UPC/GTIN Discrepancy: "${currentProduct.upcOrGtin}" vs "${targetMergeProduct.upcOrGtin}"`);
    }

    return list;
  }, [currentProduct, targetMergeProduct]);

  // Execute Merge
  const handleExecuteMerge = async () => {
    if (!currentProduct || !mergeTargetId) return;
    setMergeLoading(true);
    try {
      const res = await mergeCanonicalEntities(
        currentProduct.id || (currentProduct as any).canonicalId,
        [mergeTargetId],
        confirmConflicts,
        mergeReason || 'Curator authorized merge via workbench'
      );
      if (res.success) {
        setShowMergeModal(false);
        setMergeTargetId('');
        setMergeReason('');
        setConfirmConflicts(false);
      }
    } finally {
      setMergeLoading(false);
    }
  };

  // Execute Split
  const handleExecuteSplit = async () => {
    if (!currentProduct || splitSelectedSources.length === 0) return;
    setSplitLoading(true);
    try {
      const ok = await splitCanonicalEntity(
        currentProduct.id || (currentProduct as any).canonicalId,
        splitSelectedSources,
        splitNewTitle || undefined,
        undefined,
        splitReason || 'Detached heterogeneous listings via workbench'
      );
      if (ok) {
        setShowSplitModal(false);
        setSplitSelectedSources([]);
        setSplitNewTitle('');
        setSplitReason('');
      }
    } finally {
      setSplitLoading(false);
    }
  };

  // Execute Detach Listing
  const handleDetach = async (sourceId: string) => {
    if (!window.confirm(`Are you sure you want to detach source listing "${sourceId}" from this canonical entity?`)) {
      return;
    }
    await detachSourceListing(currentCanonicalId, sourceId, 'Manual reviewer detachment');
  };

  // Execute Attach Listing
  const handleExecuteAttach = async () => {
    if (!selectedAttachSourceId || !currentCanonicalId) return;
    setAttachLoading(true);
    try {
      const ok = await attachSourceListing(
        currentCanonicalId,
        selectedAttachSourceId,
        attachReason || 'Manual source listing linkage'
      );
      if (ok) {
        setShowAttachModal(false);
        setSelectedAttachSourceId('');
        setAttachReason('');
      }
    } finally {
      setAttachLoading(false);
    }
  };

  // Execute Undo Merge
  const handleUndoMerge = async () => {
    if (!currentProduct) return;
    if (
      !window.confirm(
        `Restore merged entity ${currentCanonicalId} and re-establish its original source listings?`
      )
    ) {
      return;
    }
    await undoMergeEntity(
      currentProduct.mergedIntoCanonicalId || currentCanonicalId,
      currentCanonicalId,
      'Curator rollback of merge operation'
    );
  };

  const sellerOffers: SellerOffer[] = currentProduct?.sellerOffers || [];
  const lowestPriceOffer = sellerOffers.length > 0
    ? sellerOffers.reduce((prev, curr) => (curr.price < prev.price ? curr : prev), sellerOffers[0])
    : null;

  const isMerged = currentProduct?.status === 'merged';
  const hasConflicts = currentProduct?.conflicts && Object.keys(currentProduct.conflicts).length > 0;

  return (
    <div id="canonical-product-page-container" className="space-y-8 pb-16">
      {/* Top Header & Entity Selector Strip */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Phase 3 Master Catalog Hub
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
            Canonical Product Management & Resolution
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Unified golden records with safe transactional merge, atomic split operations, and audit traceability.
          </p>
        </div>

        {/* Action Controls & Entity Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter chip */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({masterEntities.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('merged')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'merged'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Merged
            </button>
          </div>

          {/* Master Entity Switcher */}
          <select
            value={currentCanonicalId}
            onChange={(e) => setSelectedCanonicalId(e.target.value)}
            className="text-xs py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden max-w-[260px]"
          >
            {filteredEntities.map((p) => {
              const pid = p.id || (p as any).canonicalId;
              const title = p.title ? p.title.substring(0, 32) : pid;
              return (
                <option key={pid} value={pid}>
                  {p.status === 'merged' ? '[MERGED] ' : ''}
                  {title}... ({pid})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Merged Entity Redirect Warning Banner */}
      {isMerged && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white">
                  MERGED CANONICAL RECORD
                </span>
                <span className="text-xs font-mono text-amber-700 dark:text-amber-300 font-bold">
                  Surviving Master: {currentProduct.mergedIntoCanonicalId || 'N/A'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                This entity was merged into{' '}
                <button
                  onClick={() => currentProduct.mergedIntoCanonicalId && setSelectedCanonicalId(currentProduct.mergedIntoCanonicalId)}
                  className="font-bold underline text-purple-600 dark:text-purple-400 hover:text-purple-700"
                >
                  {currentProduct.mergedIntoCanonicalId}
                </button>
                . Source listings and catalog traffic are automatically redirected.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentProduct.mergedIntoCanonicalId && (
              <button
                onClick={() => setSelectedCanonicalId(currentProduct.mergedIntoCanonicalId)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 shadow-xs flex items-center gap-1.5"
              >
                <span>View Surviving Entity</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleUndoMerge}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo Merge (Restore)</span>
            </button>
          </div>
        </div>
      )}

      {/* Recorded Conflicts Banner */}
      {hasConflicts && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wide">
              Recorded Attribute Conflicts Flagged
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              During entity consolidation, conflicting source values were logged instead of silently overwritten:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(currentProduct.conflicts).map(([field, vals]: [string, any], i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-mono bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300"
                >
                  {field}: {Array.isArray(vals) ? vals.join(' ⟷ ') : String(vals)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {currentProduct && (
        <>
          {/* Operations Toolbar Strip */}
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Canonical Operations:
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-bold">
                {currentCanonicalId}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowMergeModal(true)}
                disabled={isMerged}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors ${
                  isMerged
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
                title="Merge another canonical entity into this survivor"
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>Merge Entity</span>
              </button>

              <button
                onClick={() => setShowSplitModal(true)}
                disabled={isMerged}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors ${
                  isMerged
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title="Detach selected source listings into a separate canonical entity"
              >
                <Split className="w-3.5 h-3.5" />
                <span>Split Listings</span>
              </button>

              <button
                onClick={() => setShowAttachModal(true)}
                disabled={isMerged}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors ${
                  isMerged
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
                title="Attach an existing seller listing to this canonical entity"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Attach SKU</span>
              </button>

              <button
                onClick={handleOpenHistory}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 shadow-xs flex items-center gap-1.5"
              >
                <History className="w-3.5 h-3.5 text-purple-600" />
                <span>Audit Trail</span>
              </button>
            </div>
          </div>

          {/* Main Canonical Product Overview Block */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Image Gallery & Quick Meta */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
              <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                  src={currentProduct.imageUrl || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&q=80'}
                  alt={currentProduct.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-600 text-white shadow-xs">
                    Canonical ID: {currentCanonicalId}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold shadow-xs text-white ${
                      isMerged ? 'bg-amber-600' : 'bg-emerald-600'
                    }`}
                  >
                    Status: {currentProduct.status || 'Active'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Master Brand</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{currentProduct.brand}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Normalized Model Number</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{currentProduct.modelNumber}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Canonical GTIN / UPC</span>
                  <span className="font-mono text-purple-600 font-bold">{currentProduct.upcOrGtin}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Normalized Title Token</span>
                  <span className="font-mono text-[10px] text-slate-500 truncate max-w-[200px]" title={currentProduct.normalizedTitle}>
                    {currentProduct.normalizedTitle || currentProduct.title}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Entity Revision Version</span>
                  <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    v{currentProduct.version || 1}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Master Title, Buy-Box Highlight, Specifications */}
            <div className="lg:col-span-7 space-y-6">
              <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
                <div>
                  <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                    {currentProduct.category} {currentProduct.subCategory && `› ${currentProduct.subCategory}`}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {currentProduct.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <div className="flex items-center gap-1 text-amber-500 font-bold">
                      <Star className="w-4 h-4 fill-amber-400" />
                      <span>{currentProduct.rating || 4.8}</span>
                    </div>
                    <span className="text-slate-400">
                      ({(currentProduct.reviewsCount || 120).toLocaleString()} aggregated multi-channel reviews)
                    </span>
                  </div>
                </div>

                {/* Best Deal Buy-Box Callout */}
                {lowestPriceOffer && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-purple-500/10 to-blue-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                          ★ BUY-BOX LEADER
                        </span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Offered by {lowestPriceOffer.sellerName}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-slate-900 dark:text-white">
                          ₹{lowestPriceOffer.price.toLocaleString('en-IN')}
                        </span>
                        {lowestPriceOffer.originalPrice > lowestPriceOffer.price && (
                          <span className="text-xs text-slate-400 line-through">
                            ₹{lowestPriceOffer.originalPrice.toLocaleString('en-IN')}
                          </span>
                        )}
                        <span className="text-xs text-emerald-600 font-bold">
                          Save ₹{(lowestPriceOffer.originalPrice - lowestPriceOffer.price).toLocaleString('en-IN')} (
                          {Math.round(
                            ((lowestPriceOffer.originalPrice - lowestPriceOffer.price) /
                              lowestPriceOffer.originalPrice) *
                              100
                          )}
                          % OFF)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {lowestPriceOffer.shippingDays} • Condition: {lowestPriceOffer.condition}
                      </p>
                    </div>

                    <button
                      onClick={() => navigateTo('price-comparison')}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors shrink-0"
                    >
                      Compare All {sellerOffers.length} Sellers
                    </button>
                  </div>
                )}

                {/* Harmonized Normalized Specifications Table */}
                <div className="space-y-2 pt-2">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Harmonized Master Specifications
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {currentProduct.attributes &&
                      Object.entries(currentProduct.attributes).map(([attrName, attrVal], i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex justify-between"
                        >
                          <span className="text-slate-400 font-medium">{attrName}:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                            {String(attrVal)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Attached Source Listings Management Matrix (Task 6) */}
          <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                  Source Listing Management & Ingest References
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Attached Seller Listings ({attachedSources.length})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAttachModal(true)}
                  disabled={isMerged}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 hover:bg-purple-200 transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Attach Source Listing</span>
                </button>
              </div>
            </div>

            {loadingSources ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading attached source listings...</div>
            ) : attachedSources.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                No external source listings directly attached to this master record.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                    <tr>
                      <th className="p-3">Source Channel</th>
                      <th className="p-3">Source SKU</th>
                      <th className="p-3">Raw Ingest Title</th>
                      <th className="p-3">Identifier (UPC/GTIN)</th>
                      <th className="p-3">Listing Price</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {attachedSources.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <Store className="w-4 h-4 text-purple-500" />
                          <span>{item.source || 'Amazon Prime'}</span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {item.sourceSku || item.id}
                        </td>
                        <td className="p-3 font-medium text-slate-900 dark:text-white max-w-[280px] truncate" title={item.title}>
                          {item.title}
                        </td>
                        <td className="p-3 font-mono text-purple-600 dark:text-purple-400">
                          {item.upcOrGtin || '—'}
                        </td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                          {item.price ? `₹${item.price.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDetach(item.id)}
                            disabled={isMerged}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Safely detach this listing from canonical entity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Group All Seller Listings Table */}
          {sellerOffers.length > 0 && (
            <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                    Cross-Platform Multi-Seller Offers ({sellerOffers.length})
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Seller Price & Inventory Matrix
                  </h3>
                </div>

                <button
                  onClick={() => navigateTo('price-comparison')}
                  className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                >
                  <span>Deep Price Dispersion Analytics</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                    <tr>
                      <th className="p-3">Seller Channel</th>
                      <th className="p-3">Reputation Rating</th>
                      <th className="p-3">Live Listing Price</th>
                      <th className="p-3">Shipping Terms</th>
                      <th className="p-3">Stock Availability</th>
                      <th className="p-3">Condition</th>
                      <th className="p-3 text-right">Buy-Box Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sellerOffers.map((offer) => {
                      const isLowest = lowestPriceOffer && offer.price === lowestPriceOffer.price;
                      return (
                        <tr
                          key={offer.id}
                          className={`transition-colors ${
                            isLowest
                              ? 'bg-purple-50/40 dark:bg-purple-950/20 font-medium'
                              : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                          }`}
                        >
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Store className="w-4 h-4 text-purple-500" />
                            <span>{offer.sellerName}</span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              <span className="font-bold">{offer.sellerRating}</span>
                              <span className="text-[10px] text-slate-400">
                                ({offer.sellerReviewCount.toLocaleString()})
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                                ₹{offer.price.toLocaleString('en-IN')}
                              </span>
                              {offer.originalPrice > offer.price && (
                                <span className="text-[10px] text-slate-400 line-through">
                                  ₹{offer.originalPrice.toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-slate-400" />
                            <span>{offer.shippingDays}</span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                offer.availability === 'In Stock'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {offer.availability}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400">{offer.condition}</td>
                          <td className="p-3 text-right">
                            {offer.isBuyBoxWinner ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                                Buy-Box Winner
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                +₹{(offer.price - (lowestPriceOffer ? lowestPriceOffer.price : 0)).toLocaleString('en-IN')} premium
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SAFE MERGE CONFIRMATION WITH REAL-TIME CONFLICTS (TASK 4 & 9)   */}
      {/* ========================================================================= */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                  <GitMerge className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    Safe Canonical Merge Workbench
                  </h3>
                  <p className="text-xs text-slate-500">
                    Surviving Entity: <span className="font-mono font-bold text-purple-600">{currentCanonicalId}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMergeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Select Source Canonical Entity to Merge:
                </label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                >
                  <option value="">-- Choose an active canonical record to merge into this survivor --</option>
                  {masterEntities
                    .filter(
                      (p) =>
                        (p.id || (p as any).canonicalId) !== currentCanonicalId &&
                        p.status !== 'merged'
                    )
                    .map((p) => {
                      const pid = p.id || (p as any).canonicalId;
                      return (
                        <option key={pid} value={pid}>
                          {p.title} ({p.brand} • {pid})
                        </option>
                      );
                    })}
                </select>
              </div>

              {/* Conflict Warnings Box */}
              {mergeConflicts.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Potential Material Conflicts Detected ({mergeConflicts.length})</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 dark:text-slate-300 font-mono">
                    {mergeConflicts.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                    The backend strictly rejects merges with incompatible attributes unless explicit confirmation is provided.
                  </p>
                </div>
              )}

              {/* Confirmation Checkbox */}
              {mergeConflicts.length > 0 && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmConflicts}
                    onChange={(e) => setConfirmConflicts(e.target.checked)}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                    I have verified these catalog differences and explicitly authorize overriding detected attribute conflicts for this merge.
                  </span>
                </label>
              )}

              {/* Justification Notes */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Merge Justification / Audit Reason:
                </label>
                <textarea
                  rows={2}
                  value={mergeReason}
                  onChange={(e) => setMergeReason(e.target.value)}
                  placeholder="e.g. Verified identical SKU packaging divergence between regional distributor listings."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 space-y-1">
                <p>• Source listings from the merged record will be safely reassigned to the survivor.</p>
                <p>• The merged record will be marked as merged with an immutable redirect pointer.</p>
                <p>• Pre-merge snapshot and rollback point will be recorded in the transaction journal.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowMergeModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteMerge}
                disabled={!mergeTargetId || (mergeConflicts.length > 0 && !confirmConflicts) || mergeLoading}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-colors flex items-center gap-1.5 ${
                  !mergeTargetId || (mergeConflicts.length > 0 && !confirmConflicts) || mergeLoading
                    ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-400'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {mergeLoading ? 'Executing Merge...' : 'Confirm & Execute Merge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SAFE ENTITY SPLIT WORKFLOW (TASK 5 & 9)                          */}
      {/* ========================================================================= */}
      {showSplitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                  <Split className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    Split Attached Listings into New Master
                  </h3>
                  <p className="text-xs text-slate-500">
                    Source Entity: <span className="font-mono font-bold text-blue-600">{currentCanonicalId}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSplitModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                Select Source Listings to Detach & Re-Canonicalize ({splitSelectedSources.length} selected):
              </label>

              {attachedSources.length === 0 ? (
                <div className="p-4 text-center rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500">
                  No source listings attached to split.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                  {attachedSources.map((item) => {
                    const isSelected = splitSelectedSources.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSplitSelectedSources((prev) =>
                            isSelected ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                          );
                        }}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/60 dark:bg-blue-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate max-w-sm">
                              {item.title}
                            </p>
                            <span className="text-[10px] text-slate-400 font-mono">
                              SKU: {item.sourceSku || item.id} • {item.source || 'Listing'}
                            </span>
                          </div>
                        </div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0">
                          {item.price ? `₹${item.price.toLocaleString('en-IN')}` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  New Canonical Product Title (Optional):
                </label>
                <input
                  type="text"
                  value={splitNewTitle}
                  onChange={(e) => setSplitNewTitle(e.target.value)}
                  placeholder="Defaults to title of the first detached listing"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Reason for Split:
                </label>
                <input
                  type="text"
                  value={splitReason}
                  onChange={(e) => setSplitReason(e.target.value)}
                  placeholder="e.g. Separate generation/model variation erroneously consolidated"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowSplitModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteSplit}
                disabled={splitSelectedSources.length === 0 || splitLoading}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-colors flex items-center gap-1.5 ${
                  splitSelectedSources.length === 0 || splitLoading
                    ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-400'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {splitLoading ? 'Executing Split...' : 'Confirm & Split'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ATTACH SOURCE LISTING (TASK 6 & 9)                                */}
      {/* ========================================================================= */}
      {showAttachModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    Attach Source Listing SKU
                  </h3>
                  <p className="text-xs text-slate-500">
                    Target Master Entity: <span className="font-mono font-bold text-emerald-600">{currentCanonicalId}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAttachModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Select Source Listing to Attach:
                </label>
                <select
                  value={selectedAttachSourceId}
                  onChange={(e) => setSelectedAttachSourceId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                >
                  <option value="">-- Choose an ingested seller listing --</option>
                  {products
                    .filter(
                      (p) =>
                        p.status !== 'Canonical Master' &&
                        !attachedSources.some((s) => s.id === p.id)
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.source} • SKU: {p.sourceSku || p.id})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Audit Reason / Curator Notes:
                </label>
                <input
                  type="text"
                  value={attachReason}
                  onChange={(e) => setAttachReason(e.target.value)}
                  placeholder="e.g. Verified seller SKU maps to identical hardware revision"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowAttachModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAttach}
                disabled={!selectedAttachSourceId || attachLoading}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-colors flex items-center gap-1.5 ${
                  !selectedAttachSourceId || attachLoading
                    ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-400'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {attachLoading ? 'Attaching...' : 'Attach Listing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ENTITY AUDIT & MUTATION HISTORY TIMELINE (TASK 7 & 9)            */}
      {/* ========================================================================= */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    Canonical Entity Audit & History Trail
                  </h3>
                  <p className="text-xs text-slate-500">
                    Entity ID: <span className="font-mono font-bold text-purple-600">{currentCanonicalId}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading audit events...</div>
            ) : entityHistory.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-500">
                No recorded mutation events found for this canonical entity.
              </div>
            ) : (
              <div className="space-y-3">
                {entityHistory.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.type === 'merge'
                              ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                              : item.type === 'split'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              : item.type === 'undo'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {item.type || 'EVENT'}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {item.action}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {item.timestamp}
                      </span>
                    </div>

                    <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                      {item.details || item.reason || 'Operation recorded in immutable audit log.'}
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                      <span>Actor: {item.user || 'system'}</span>
                      {item.correlationId && <span>TxID: {item.correlationId}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
