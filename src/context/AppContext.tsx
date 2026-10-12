import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  PageId,
  ProductItem,
  MatchCandidatePair,
  DuplicateCluster,
  SellerFeedConfig,
  AuditLogEntry,
  SystemNotification,
  CanonicalProduct
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_MATCH_PAIRS,
  INITIAL_DUPLICATE_CLUSTERS,
  SELLER_FEEDS,
  AUDIT_LOGS,
  INITIAL_NOTIFICATIONS
} from '../data/mockData';
import {
  getState,
  putState,
  compareProducts,
  ApiError,
  AppState,
  runMatching,
  recordMatchDecision,
  resolveDuplicateCluster,
  listCanonicalProducts,
  mergeCanonicalProducts,
  splitCanonicalProduct,
  undoMergeCanonicalProduct,
  attachSourceToCanonical,
  detachSourceFromCanonical
} from '../lib/api';
import confetti from 'canvas-confetti';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

interface AppContextType {
  currentPage: PageId;
  navigateTo: (page: PageId, options?: { canonicalId?: string }) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  products: ProductItem[];
  canonicalProducts: ProductItem[];
  canonicalRecords: CanonicalProduct[];
  selectedCanonicalId: string;
  setSelectedCanonicalId: (id: string) => void;
  matchPairs: MatchCandidatePair[];
  duplicateClusters: DuplicateCluster[];
  sellerFeeds: SellerFeedConfig[];
  auditLogs: AuditLogEntry[];
  notifications: SystemNotification[];
  toasts: ToastMessage[];
  backendError: string | null;
  addToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;
  approveMatch: (id: string) => Promise<void>;
  rejectMatch: (id: string) => Promise<void>;
  mergeMatch: (id: string) => void;
  mergeDuplicateCluster: (clusterId: string) => Promise<void>;
  removeDuplicateItem: (clusterId: string, itemId: string) => void;
  toggleSellerFeed: (id: string) => void;
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;
  autoMergeThreshold: number;
  setAutoMergeThreshold: (val: number) => void;
  addNewIngestedProducts: (newProducts: ProductItem[]) => void;
  runEntityMatching: () => Promise<number>;
  quickSearchQuery: string;
  setQuickSearchQuery: (q: string) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  // Phase 3 canonical management operations
  mergeCanonicalEntities: (
    survivorId: string,
    mergedIds: string[],
    confirmConflicts?: boolean,
    reason?: string
  ) => Promise<{ success: boolean; conflicts?: any[] }>;
  splitCanonicalEntity: (
    canonicalId: string,
    sourceProductIds: string[],
    newTitle?: string,
    destId?: string,
    reason?: string
  ) => Promise<boolean>;
  undoMergeEntity: (
    canonicalId: string,
    mergedId?: string,
    reason?: string
  ) => Promise<boolean>;
  attachSourceListing: (
    canonicalId: string,
    sourceProductId: string,
    reason?: string
  ) => Promise<boolean>;
  detachSourceListing: (
    canonicalId: string,
    sourceProductId: string,
    reason?: string
  ) => Promise<boolean>;
  reloadState: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<PageId>('landing');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [canonicalRecords, setCanonicalRecords] = useState<CanonicalProduct[]>([]);
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<string>('can-001');
  const [matchPairs, setMatchPairs] = useState<MatchCandidatePair[]>(INITIAL_MATCH_PAIRS);
  const [duplicateClusters, setDuplicateClusters] = useState<DuplicateCluster[]>(INITIAL_DUPLICATE_CLUSTERS);
  const [sellerFeeds, setSellerFeeds] = useState<SellerFeedConfig[]>(SELLER_FEEDS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(AUDIT_LOGS);
  const [notifications, setNotifications] = useState<SystemNotification[]>(INITIAL_NOTIFICATIONS);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [autoMergeThreshold, setAutoMergeThreshold] = useState<number>(92);
  const [quickSearchQuery, setQuickSearchQuery] = useState<string>('');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const [backendReady, setBackendReady] = useState<boolean>(false);

  // Hydrate application state from the Python API on startup. If this is a fresh
  // install, seed the JSON file store with the existing demo catalog.
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const seedState: AppState = {
        products: INITIAL_PRODUCTS,
        matchPairs: INITIAL_MATCH_PAIRS,
        duplicateClusters: INITIAL_DUPLICATE_CLUSTERS,
        sellerFeeds: SELLER_FEEDS,
        auditLogs: AUDIT_LOGS,
        notifications: INITIAL_NOTIFICATIONS,
        autoMergeThreshold: 92
      };
      try {
        const state = await getState();
        if (cancelled) return;
        
        if (state && state.products && state.products.length > 0) {
          setProducts(Array.isArray(state.products) ? state.products : INITIAL_PRODUCTS);
          setMatchPairs(Array.isArray(state.matchPairs) ? state.matchPairs : INITIAL_MATCH_PAIRS);
          setDuplicateClusters(Array.isArray(state.duplicateClusters) ? state.duplicateClusters : INITIAL_DUPLICATE_CLUSTERS);
          setSellerFeeds(Array.isArray(state.sellerFeeds) ? state.sellerFeeds : SELLER_FEEDS);
          setAuditLogs(Array.isArray(state.auditLogs) ? state.auditLogs : AUDIT_LOGS);
          setNotifications(Array.isArray(state.notifications) ? state.notifications : INITIAL_NOTIFICATIONS);
          if (typeof state.autoMergeThreshold === 'number') setAutoMergeThreshold(state.autoMergeThreshold);
        } else {
          // Empty state: seed with demo data
          await putState(seedState);
        }
        try {
          const canonicalRes = await listCanonicalProducts({ limit: 100 });
          if (canonicalRes && Array.isArray(canonicalRes.items)) {
            setCanonicalRecords(canonicalRes.items);
          }
        } catch {
          // ignore if backend canonical endpoint still initializing
        }
        if (!cancelled) {
          setBackendReady(true);
          setBackendError(null);
        }
      } catch (error) {
        console.error('Backend initialization failed:', error);
        if (!cancelled) {
          setBackendReady(false);
          const message = error instanceof ApiError 
            ? `Backend error: ${error.detail || error.message}`
            : 'Backend unreachable. Using local demo state.';
          setBackendError(message);
        }
      }
    };
    void hydrate();
    return () => { cancelled = true; };
  }, []);

  // Persist domain state after hydration. UI-only state (page, toasts, theme)
  // intentionally remains client-side.
  useEffect(() => {
    if (!backendReady) return;
    const persist = async () => {
      try {
        await putState({
          products,
          matchPairs,
          duplicateClusters,
          sellerFeeds,
          auditLogs,
          notifications,
          autoMergeThreshold
        });
        setBackendError(null);
      } catch (error) {
        console.error('Backend state save failed:', error);
        const message = error instanceof ApiError
          ? `Failed to save: ${error.detail || error.message}`
          : 'Failed to save state to backend';
        setBackendError(message);
      }
    };
    void persist();
  }, [backendReady, products, matchPairs, duplicateClusters, sellerFeeds, auditLogs, notifications, autoMergeThreshold]);

  const openCommandPalette = () => setIsCommandPaletteOpen(true);
  const closeCommandPalette = () => setIsCommandPaletteOpen(false);

  // Global Ctrl+K / Cmd+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const addToast = (title: string, message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const id = 'toast-' + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const navigateTo = (page: PageId, options?: { canonicalId?: string }) => {
    if (options?.canonicalId) {
      setSelectedCanonicalId(options.canonicalId);
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const canonicalProducts = products.filter((p) => p.status === 'Canonical Master');

  const approveMatch = async (id: string) => {
    try {
      const updated = await recordMatchDecision(id, { decision: 'approved', reviewer: 'ui_operator' });
      setMatchPairs((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
      );
      const target = matchPairs.find((m) => m.id === id);
      const newLog: AuditLogEntry = {
        id: 'log-' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        user: 'admin.operator@enterprise.io',
        action: 'Verified Match Candidate',
        target: target ? target.primaryProduct.title : id,
        details: `Entity match approved with confidence ${target?.overallScore}%`,
        type: 'verification'
      };
      setAuditLogs((prev) => [newLog, ...prev]);
      addToast('Match Verified', 'Entity relationship approved and synced to index.', 'success');
    } catch (error) {
      const message = error instanceof ApiError
        ? (error.status === 409 ? error.detail || 'Already decided.' : error.detail || error.message)
        : 'Could not approve match.';
      addToast('Approve failed', message, 'error');
    }
  };

  const rejectMatch = async (id: string) => {
    try {
      const updated = await recordMatchDecision(id, { decision: 'rejected', reviewer: 'ui_operator' });
      setMatchPairs((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
      );
      const target = matchPairs.find((m) => m.id === id);
      const newLog: AuditLogEntry = {
        id: 'log-' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        user: 'admin.operator@enterprise.io',
        action: 'Rejected False Positive Match',
        target: target ? target.primaryProduct.title : id,
        details: 'Marked as distinct entity. Isolated in separate cluster.',
        type: 'override'
      };
      setAuditLogs((prev) => [newLog, ...prev]);
      addToast('Match Discarded', 'Candidate flagged as false positive.', 'warning');
    } catch (error) {
      const message = error instanceof ApiError
        ? (error.status === 409 ? error.detail || 'Already decided.' : error.detail || error.message)
        : 'Could not reject match.';
      addToast('Reject failed', message, 'error');
    }
  };

  const mergeMatch = (id: string) => {
    const pair = matchPairs.find((p) => p.id === id);
    if (!pair) return;

    setMatchPairs((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, matchStatus: 'Merged' } : item
      )
    );

    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch {
      // Ignore if canvas confetti is restricted
    }

    const newLog: AuditLogEntry = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: 'admin.operator@enterprise.io',
      action: 'Unified 2 Product Entities',
      target: pair.primaryProduct.title,
      details: `Merged secondary listing (${pair.secondaryProduct.source}) into primary canonical master.`,
      type: 'merge'
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    addToast('Entities Successfully Merged', `Merged ${pair.secondaryProduct.source} listing into canonical record.`, 'success');
  };

  const mergeDuplicateCluster = async (clusterId: string) => {
    try {
      await resolveDuplicateCluster(clusterId, 'ui_operator');
      setDuplicateClusters((prev) =>
        prev.map((cluster) =>
          cluster.id === clusterId ? { ...cluster, status: 'Resolved' } : cluster
        )
      );
      try {
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      } catch { /* ignore */ }
      const cluster = duplicateClusters.find((c) => c.id === clusterId);
      const newLog: AuditLogEntry = {
        id: 'log-' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        user: 'admin.operator@enterprise.io',
        action: 'Resolved Duplicate Cluster',
        target: cluster ? cluster.canonicalTitle : clusterId,
        details: `Merged ${cluster?.items.length || 0} duplicate listings into unified single entity.`,
        type: 'merge'
      };
      setAuditLogs((prev) => [newLog, ...prev]);
      addToast('Cluster Resolved', 'All duplicate listings consolidated into master record.', 'success');
    } catch (error) {
      const message = error instanceof ApiError ? error.detail || error.message : 'Could not resolve cluster.';
      addToast('Resolve failed', message, 'error');
    }
  };

  const removeDuplicateItem = (clusterId: string, itemId: string) => {
    setDuplicateClusters((prev) =>
      prev.map((cluster) => {
        if (cluster.id !== clusterId) return cluster;
        const newItems = cluster.items.filter((item) => item.id !== itemId);
        return {
          ...cluster,
          items: newItems,
          status: newItems.length <= 1 ? 'Resolved' : cluster.status
        };
      })
    );
    addToast('Listing Removed', 'Item removed from duplicate cluster.', 'info');
  };

  const toggleSellerFeed = (id: string) => {
    setSellerFeeds((prev) =>
      prev.map((f) => (f.id === id ? { ...f, active: !f.active } : f))
    );
    const feed = sellerFeeds.find((f) => f.id === id);
    addToast('Feed Status Updated', `${feed?.name} is now ${!feed?.active ? 'Enabled' : 'Paused'}.`, 'info');
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const clearAllNotifications = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    addToast('Notifications Cleared', 'All alerts marked as read.', 'info');
  };

  const runEntityMatching = async (): Promise<number> => {
    if (products.length < 2) {
      addToast('Not enough products', 'Add at least two products before running entity matching.', 'warning');
      return 0;
    }
    try {
      const result = await runMatching({ max_candidates: 5000, incremental: false });
      // Update local state from the real backend results
      setMatchPairs(result.matchPairs || []);
      setDuplicateClusters(result.duplicateClusters || []);
      const meta = result.runMetadata;
      const log: AuditLogEntry = {
        id: 'log-' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        user: 'matching_engine',
        action: 'Backend Entity Matching Run',
        target: `${meta.productsScanned} catalog products`,
        details: (
          `Run ${meta.runId}: ${meta.candidatesGenerated} candidates generated, ` +
          `${result.pairsCount} pairs scored, ${result.clustersCount} duplicate clusters found.`
        ),
        type: 'verification'
      };
      setAuditLogs((prev) => [log, ...prev]);
      addToast(
        'Matching complete',
        `${result.pairsCount} candidate pairs and ${result.clustersCount} clusters returned by the Python backend.`,
        'success'
      );
      return result.pairsCount;
    } catch (error) {
      const message = error instanceof ApiError
        ? error.detail || error.message
        : error instanceof Error
          ? error.message
          : 'Could not run matching.';
      addToast('Matching failed', message, 'error');
      return 0;
    }
  };

  const addNewIngestedProducts = (newItems: ProductItem[]) => {
    setProducts((prev) => [...newItems, ...prev]);
    const newLog: AuditLogEntry = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: 'batch_uploader',
      action: 'Batch Catalog Ingestion',
      target: `${newItems.length} Products Ingested`,
      details: 'Normalized headers, generated LSH MinHash tokens, and mapped attributes.',
      type: 'import'
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    addToast('Upload Complete', `${newItems.length} products ingested and queued for entity resolution.`, 'success');
  };

  const reloadState = async () => {
    try {
      const state = await getState();
      if (state) {
        if (Array.isArray(state.products)) setProducts(state.products);
        if (Array.isArray(state.matchPairs)) setMatchPairs(state.matchPairs);
        if (Array.isArray(state.duplicateClusters)) setDuplicateClusters(state.duplicateClusters);
        if (Array.isArray(state.auditLogs)) setAuditLogs(state.auditLogs);
      }
      try {
        const canonicalRes = await listCanonicalProducts({ limit: 100 });
        if (canonicalRes && Array.isArray(canonicalRes.items)) {
          setCanonicalRecords(canonicalRes.items);
        }
      } catch {
        // ignore
      }
    } catch (err) {
      console.error('Failed to reload state:', err);
    }
  };

  const mergeCanonicalEntities = async (
    survivorId: string,
    mergedIds: string[],
    confirmConflicts: boolean = false,
    reason: string = ''
  ): Promise<{ success: boolean; conflicts?: any[] }> => {
    try {
      await mergeCanonicalProducts({
        survivingCanonicalId: survivorId,
        mergedCanonicalIds: mergedIds,
        confirmConflicts,
        reviewer: 'admin.operator@enterprise.io',
        reason: reason || 'Manual canonical merge'
      });
      await reloadState();
      try { confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } }); } catch { /* ignore */ }
      addToast('Entities Successfully Merged', `Merged ${mergedIds.length} canonical records into master.`, 'success');
      return { success: true };
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 409 && error.detail && typeof error.detail === 'object') {
        const conflicts = (error.detail as any).conflicts || [];
        return { success: false, conflicts };
      }
      const message = error instanceof ApiError ? error.detail || error.message : 'Could not merge canonical entities.';
      addToast('Merge failed', String(message), 'error');
      return { success: false };
    }
  };

  const splitCanonicalEntity = async (
    canonicalId: string,
    sourceProductIds: string[],
    newTitle?: string,
    destId?: string,
    reason?: string
  ): Promise<boolean> => {
    try {
      await splitCanonicalProduct(canonicalId, {
        sourceProductIds,
        newCanonicalTitle: newTitle,
        destinationCanonicalId: destId,
        reviewer: 'admin.operator@enterprise.io',
        reason: reason || 'Split distinct listings'
      });
      await reloadState();
      addToast('Canonical Entity Split', `Detached ${sourceProductIds.length} listings into separate canonical record.`, 'success');
      return true;
    } catch (error: any) {
      const message = error instanceof ApiError ? error.detail || error.message : 'Could not split entity.';
      addToast('Split failed', String(message), 'error');
      return false;
    }
  };

  const undoMergeEntity = async (
    canonicalId: string,
    mergedId?: string,
    reason?: string
  ): Promise<boolean> => {
    try {
      await undoMergeCanonicalProduct(canonicalId, {
        mergedCanonicalId: mergedId,
        reviewer: 'admin.operator@enterprise.io',
        reason: reason || 'Compensating undo merge'
      });
      await reloadState();
      addToast('Merge Reversal Completed', 'Restored previously merged entity and its source listings.', 'success');
      return true;
    } catch (error: any) {
      const message = error instanceof ApiError ? error.detail || error.message : 'Could not reverse merge.';
      addToast('Undo failed', String(message), 'error');
      return false;
    }
  };

  const attachSourceListing = async (
    canonicalId: string,
    sourceProductId: string,
    reason?: string
  ): Promise<boolean> => {
    try {
      await attachSourceToCanonical(canonicalId, {
        sourceProductId,
        reviewer: 'admin.operator@enterprise.io',
        reason: reason || 'Manual source listing attachment'
      });
      await reloadState();
      addToast('Listing Attached', `Attached SKU to canonical record.`, 'success');
      return true;
    } catch (error: any) {
      const message = error instanceof ApiError ? error.detail || error.message : 'Could not attach listing.';
      addToast('Attach failed', String(message), 'error');
      return false;
    }
  };

  const detachSourceListing = async (
    canonicalId: string,
    sourceProductId: string,
    reason?: string
  ): Promise<boolean> => {
    try {
      await detachSourceFromCanonical(canonicalId, {
        sourceProductId,
        reviewer: 'admin.operator@enterprise.io',
        reason: reason || 'Manual source listing detachment'
      });
      await reloadState();
      addToast('Listing Detached', `Detached source listing from canonical entity.`, 'info');
      return true;
    } catch (error: any) {
      const message = error instanceof ApiError ? error.detail || error.message : 'Could not detach listing.';
      addToast('Detach failed', String(message), 'error');
      return false;
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentPage,
        navigateTo,
        isDarkMode,
        toggleDarkMode,
        products,
        canonicalProducts,
        canonicalRecords,
        selectedCanonicalId,
        setSelectedCanonicalId,
        matchPairs,
        duplicateClusters,
        sellerFeeds,
        auditLogs,
        notifications,
        toasts,
        backendError,
        addToast,
        removeToast,
        approveMatch,
        rejectMatch,
        mergeMatch,
        mergeDuplicateCluster,
        removeDuplicateItem,
        toggleSellerFeed,
        markNotificationRead,
        clearAllNotifications,
        autoMergeThreshold,
        setAutoMergeThreshold,
        addNewIngestedProducts,
        runEntityMatching,
        quickSearchQuery,
        setQuickSearchQuery,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        openCommandPalette,
        closeCommandPalette,
        mergeCanonicalEntities,
        splitCanonicalEntity,
        undoMergeEntity,
        attachSourceListing,
        detachSourceListing,
        reloadState
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
