import {
  ProductItem,
  MatchCandidatePair,
  DuplicateCluster,
  SellerFeedConfig,
  AuditLogEntry,
  SystemNotification,
  MatchRunMetadata,
  MatchingSettings,
  CanonicalProduct,
  CanonicalMergeRequest,
  CanonicalSplitRequest,
  CanonicalUndoMergeRequest,
  SourceAttachRequest,
  SourceDetachRequest
} from '../types';

/**
 * Base URL for backend API. Reads from VITE_API_BASE_URL environment variable,
 * defaults to http://localhost:8000 for local development.
 */
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * ApiError represents a failure in API communication.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * AppState represents the complete serializable application state.
 */
export interface AppState {
  products: ProductItem[];
  matchPairs: MatchCandidatePair[];
  duplicateClusters: DuplicateCluster[];
  sellerFeeds: SellerFeedConfig[];
  auditLogs: AuditLogEntry[];
  notifications: SystemNotification[];
  autoMergeThreshold?: number;
}

/**
 * IngestResult represents the response from a file upload to the ingestion endpoint.
 */
export interface IngestResult {
  filename: string;
  parsed: number;
  products: ProductItem[];
  committed: boolean;
  inserted?: number;
  skippedDuplicates?: number;
}

/**
 * AnalyticsSummary represents aggregated metrics from the backend.
 */
export interface AnalyticsSummary {
  totalProducts: number;
  canonicalProducts: number;
  pendingMatches: number;
  approvedMatches: number;
  resolvedClusters: number;
  activeClusters: number;
  auditEvents: number;
  storage: string;
}

/**
 * fetchJSON handles HTTP requests with consistent error handling, timeout, and typing.
 */
async function fetchJSON<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  timeout: number = 15000
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const options: RequestInit = {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let detail: string;
      try {
        const errorBody = await response.json();
        detail = errorBody.detail || response.statusText;
      } catch {
        detail = response.statusText;
      }
      throw new ApiError(
        `HTTP ${response.status}: ${detail}`,
        response.status,
        detail
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(
        'Request timeout (15s exceeded)',
        408,
        'The backend did not respond within 15 seconds'
      );
    }
    if (error instanceof TypeError) {
      throw new ApiError(
        'Network error: could not connect to backend',
        0,
        'Failed to establish connection to the backend server'
      );
    }
    throw new ApiError(
      'Unknown error during API request',
      500,
      String(error)
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * getHealth retrieves the health status of the backend.
 */
export async function getHealth(): Promise<{ status: string; timestamp?: string }> {
  return fetchJSON('GET', '/api/health');
}

/**
 * getState retrieves the full application state from the backend.
 */
export async function getState(): Promise<AppState> {
  const response = await fetchJSON<{ state: AppState | null }>('GET', '/api/state');
  if (response.state === null) {
    return {
      products: [],
      matchPairs: [],
      duplicateClusters: [],
      sellerFeeds: [],
      auditLogs: [],
      notifications: [],
      autoMergeThreshold: 92
    };
  }
  return response.state;
}

/**
 * putState persists the full application state to the backend.
 */
export async function putState(state: AppState): Promise<void> {
  await fetchJSON('PUT', '/api/state', { state });
}

/**
 * listProducts retrieves a paginated list of products with optional filtering.
 */
export async function listProducts(params?: {
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: ProductItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.q) query.append('q', params.q);
  if (params?.limit !== undefined) query.append('limit', String(params.limit));
  if (params?.offset !== undefined) query.append('offset', String(params.offset));

  const path = query.toString() ? `/api/products?${query.toString()}` : '/api/products';
  return fetchJSON('GET', path);
}

/**
 * createProduct creates a new product in the catalog.
 */
export async function createProduct(product: Partial<ProductItem>): Promise<ProductItem> {
  return fetchJSON('POST', '/api/products', { product });
}

/**
 * updateProduct updates an existing product by ID.
 */
export async function updateProduct(
  id: string,
  product: Partial<ProductItem>
): Promise<ProductItem> {
  return fetchJSON('PUT', `/api/products/${encodeURIComponent(id)}`, { product });
}

/**
 * deleteProduct deletes a product by ID.
 */
export async function deleteProduct(id: string): Promise<void> {
  await fetchJSON('DELETE', `/api/products/${encodeURIComponent(id)}`);
}

/**
 * compareProducts runs entity matching on a list of products.
 */
export async function compareProducts(
  products: ProductItem[],
  threshold?: number
): Promise<{ items: MatchCandidatePair[]; count: number }> {
  return fetchJSON('POST', '/api/matching/compare', {
    products,
    threshold: threshold ?? 65
  });
}

/**
 * uploadFile uploads a file to the ingestion endpoint and optionally commits it.
 */
async function uploadFile(
  file: File,
  commit: boolean = false
): Promise<IngestResult> {
  const url = `${BASE_URL}/api/ingest/upload?commit=${commit}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for file uploads

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    if (!response.ok) {
      let detail: string;
      try {
        const errorBody = await response.json();
        detail = errorBody.detail || response.statusText;
      } catch {
        detail = response.statusText;
      }
      throw new ApiError(
        `HTTP ${response.status}: ${detail}`,
        response.status,
        detail
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(
        'File upload timeout (30s exceeded)',
        408,
        'The backend did not process the file within 30 seconds'
      );
    }
    if (error instanceof TypeError) {
      throw new ApiError(
        'Network error: could not upload file',
        0,
        'Failed to establish connection to the backend server'
      );
    }
    throw new ApiError(
      'Unknown error during file upload',
      500,
      String(error)
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * getAnalyticsSummary retrieves aggregated metrics from the backend.
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return fetchJSON('GET', '/api/analytics/summary');
}

/**
 * uploadIngestionFile is an alias for uploadFile that matches backend naming conventions.
 */
export const uploadIngestionFile = uploadFile;

// ============================================================================
// Phase 2 — Entity Resolution Engine API Functions
// ============================================================================

/**
 * RunMatchingOptions configure the POST /api/matching/run request.
 */
export interface RunMatchingOptions {
  settings?: Partial<MatchingSettings>;
  max_candidates?: number;
  incremental?: boolean;
}

/**
 * RunMatchingResult is the response from POST /api/matching/run.
 */
export interface RunMatchingResult {
  runMetadata: MatchRunMetadata;
  pairsCount: number;
  clustersCount: number;
  matchPairs: MatchCandidatePair[];
  duplicateClusters: DuplicateCluster[];
}

/**
 * runMatching triggers a full entity-resolution run on the persisted catalog.
 */
export async function runMatching(
  options?: RunMatchingOptions
): Promise<RunMatchingResult> {
  return fetchJSON('POST', '/api/matching/run', options ?? {}, 60000);
}

/**
 * ListCandidatesParams filters for GET /api/matching/candidates.
 */
export interface ListCandidatesParams {
  status?: string;
  confidence?: string;
  limit?: number;
  offset?: number;
  min_score?: number;
}

/**
 * listMatchCandidates fetches paginated, filtered match candidates from the backend.
 */
export async function listMatchCandidates(
  params?: ListCandidatesParams
): Promise<{ items: MatchCandidatePair[]; total: number; limit: number; offset: number }> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'All') query.append('status', params.status);
  if (params?.confidence && params.confidence !== 'All') query.append('confidence', params.confidence);
  if (params?.limit !== undefined) query.append('limit', String(params.limit));
  if (params?.offset !== undefined) query.append('offset', String(params.offset));
  if (params?.min_score !== undefined) query.append('min_score', String(params.min_score));
  const path = query.toString()
    ? `/api/matching/candidates?${query.toString()}`
    : '/api/matching/candidates';
  return fetchJSON('GET', path);
}

/**
 * getMatchCandidate fetches a single match candidate by ID.
 */
export async function getMatchCandidate(pairId: string): Promise<MatchCandidatePair> {
  return fetchJSON('GET', `/api/matching/candidates/${encodeURIComponent(pairId)}`);
}

/**
 * ReviewDecisionPayload is the body for recording a reviewer decision.
 */
export interface ReviewDecisionPayload {
  decision: 'approved' | 'rejected';
  reviewer?: string;
  notes?: string;
}

/**
 * recordMatchDecision records an Approve or Reject decision on a match candidate.
 * Returns 409 if the candidate already has a different finalised decision.
 */
export async function recordMatchDecision(
  pairId: string,
  payload: ReviewDecisionPayload
): Promise<MatchCandidatePair> {
  return fetchJSON(
    'POST',
    `/api/matching/candidates/${encodeURIComponent(pairId)}/decision`,
    payload
  );
}

/**
 * overrideMatchDecision force-overrides a finalised decision (recorded separately in audit log).
 */
export async function overrideMatchDecision(
  pairId: string,
  payload: ReviewDecisionPayload
): Promise<MatchCandidatePair> {
  return fetchJSON(
    'POST',
    `/api/matching/candidates/${encodeURIComponent(pairId)}/override`,
    payload
  );
}

/**
 * listDuplicateClusters fetches duplicate clusters from the backend.
 */
export async function listDuplicateClusters(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: DuplicateCluster[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'All') query.append('status', params.status);
  if (params?.limit !== undefined) query.append('limit', String(params.limit));
  if (params?.offset !== undefined) query.append('offset', String(params.offset));
  const path = query.toString() ? `/api/duplicates?${query.toString()}` : '/api/duplicates';
  return fetchJSON('GET', path);
}

/**
 * resolveDuplicateCluster marks a duplicate cluster as Resolved.
 */
export async function resolveDuplicateCluster(
  clusterId: string,
  reviewer: string = 'ui_user'
): Promise<DuplicateCluster> {
  return fetchJSON(
    'POST',
    `/api/duplicates/${encodeURIComponent(clusterId)}/resolve?reviewer=${encodeURIComponent(reviewer)}`
  );
}

/**
 * getMatchingSettings retrieves the current matching engine settings.
 */
export async function getMatchingSettings(): Promise<MatchingSettings> {
  return fetchJSON('GET', '/api/matching/settings');
}

/**
 * updateMatchingSettings updates the matching engine settings.
 */
export async function updateMatchingSettings(
  settings: Partial<MatchingSettings>
): Promise<MatchingSettings> {
  return fetchJSON('PUT', '/api/matching/settings', { settings });
}

/**
 * listMatchingRuns retrieves recent matching run history.
 */
export async function listMatchingRuns(
  limit: number = 10
): Promise<{ items: MatchRunMetadata[]; total: number }> {
  return fetchJSON('GET', `/api/matching/runs?limit=${limit}`);
}

// ===========================================================================
// Phase 3 API Client Functions
// ===========================================================================

/**
 * listCanonicalProducts retrieves paginated canonical products with optional filtering.
 */
export async function listCanonicalProducts(params?: {
  q?: string;
  brand?: string;
  category?: string;
  status?: string;
  limit?: number;
  pageSize?: number;
  offset?: number;
}): Promise<{ items: CanonicalProduct[]; total: number; limit: number; offset: number }> {
  const query = new URLSearchParams();
  if (params?.q) query.append('q', params.q);
  if (params?.brand && params.brand !== 'All') query.append('brand', params.brand);
  if (params?.category && params.category !== 'All') query.append('category', params.category);
  if (params?.status && params.status !== 'All') query.append('status', params.status);
  const limitVal = params?.limit ?? params?.pageSize;
  if (limitVal !== undefined) query.append('limit', String(limitVal));
  if (params?.offset !== undefined) query.append('offset', String(params.offset));

  const path = query.toString() ? `/api/canonical?${query.toString()}` : '/api/canonical';
  return fetchJSON('GET', path);
}

/**
 * getCanonicalProduct retrieves a single canonical product by ID.
 */
export async function getCanonicalProduct(
  id: string,
  followRedirect: boolean = false
): Promise<CanonicalProduct> {
  return fetchJSON('GET', `/api/canonical/${encodeURIComponent(id)}?follow_redirect=${followRedirect}`);
}

/**
 * createCanonicalProduct creates a new canonical entity in the catalog.
 */
export async function createCanonicalProduct(
  product: Partial<CanonicalProduct> & { title: string }
): Promise<CanonicalProduct> {
  return fetchJSON('POST', '/api/canonical', product);
}

/**
 * updateCanonicalProduct updates editable fields of a canonical entity.
 */
export async function updateCanonicalProduct(
  id: string,
  product: Partial<CanonicalProduct>
): Promise<CanonicalProduct> {
  return fetchJSON('PUT', `/api/canonical/${encodeURIComponent(id)}`, product);
}

/**
 * archiveCanonicalProduct deactivates a canonical entity.
 */
export async function archiveCanonicalProduct(
  id: string,
  reason: string = 'Archived via workbench'
): Promise<CanonicalProduct> {
  return fetchJSON(
    'POST',
    `/api/canonical/${encodeURIComponent(id)}/archive`,
    { reason }
  );
}

/**
 * getCanonicalSources retrieves all source listings attached to a canonical product.
 */
export async function getCanonicalSources(id: string): Promise<ProductItem[]> {
  return fetchJSON('GET', `/api/canonical/${encodeURIComponent(id)}/sources`);
}

/**
 * getCanonicalHistory retrieves audit and match history for a canonical product.
 */
export async function getCanonicalHistory(id: string): Promise<{
  canonicalId: string;
  auditLogs: AuditLogEntry[];
  matchPairs: MatchCandidatePair[];
}> {
  return fetchJSON('GET', `/api/canonical/${encodeURIComponent(id)}/history`);
}

/**
 * mergeCanonicalProducts executes a transactional safe merge into a surviving entity.
 */
export async function mergeCanonicalProducts(payload: CanonicalMergeRequest): Promise<{
  merged: boolean;
  survivor: CanonicalProduct;
  mergedCount: number;
  transferredSourcesCount: number;
  transactionId: string;
  conflictsOverridden?: number;
}> {
  return fetchJSON('POST', '/api/canonical/merge', payload);
}

/**
 * splitCanonicalProduct detaches source listings from a canonical product.
 */
export async function splitCanonicalProduct(
  id: string,
  payload: CanonicalSplitRequest
): Promise<{
  split: boolean;
  sourceCanonical: CanonicalProduct;
  destinationCanonical: CanonicalProduct;
  detachedCount: number;
  transactionId: string;
}> {
  return fetchJSON('POST', `/api/canonical/${encodeURIComponent(id)}/split`, payload);
}

/**
 * undoMergeCanonicalProduct reverses a prior entity merge.
 */
export async function undoMergeCanonicalProduct(
  id: string,
  payload?: CanonicalUndoMergeRequest
): Promise<{
  undone: boolean;
  survivor: CanonicalProduct;
  restoredEntity: CanonicalProduct;
  transactionId: string;
}> {
  return fetchJSON('POST', `/api/canonical/${encodeURIComponent(id)}/undo-merge`, payload || {});
}

/**
 * attachSourceToCanonical attaches an existing source listing to a canonical entity.
 */
export async function attachSourceToCanonical(
  id: string,
  payload: SourceAttachRequest
): Promise<{
  attached: boolean;
  canonical: CanonicalProduct;
  sourceListing: ProductItem;
  reassignedFrom?: string | null;
}> {
  return fetchJSON('POST', `/api/canonical/${encodeURIComponent(id)}/sources/attach`, payload);
}

/**
 * detachSourceFromCanonical detaches a source listing from a canonical entity.
 */
export async function detachSourceFromCanonical(
  id: string,
  payload: SourceDetachRequest
): Promise<{
  detached: boolean;
  canonical: CanonicalProduct;
  detachedSourceId: string;
}> {
  return fetchJSON('POST', `/api/canonical/${encodeURIComponent(id)}/sources/detach`, payload);
}

/**
 * listAuditLogs retrieves filterable, paginated system audit history.
 */
export async function listAuditLogs(params?: {
  entityId?: string;
  actionType?: string;
  user?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: AuditLogEntry[]; total: number; limit: number; offset: number }> {
  const query = new URLSearchParams();
  if (params?.entityId) query.append('entity_id', params.entityId);
  if (params?.actionType && params.actionType !== 'all') query.append('action_type', params.actionType);
  if (params?.user && params.user !== 'all') query.append('user', params.user);
  if (params?.startTime) query.append('start_time', params.startTime);
  if (params?.endTime) query.append('end_time', params.endTime);
  if (params?.limit !== undefined) query.append('limit', String(params.limit));
  if (params?.offset !== undefined) query.append('offset', String(params.offset));

  const path = query.toString() ? `/api/audit?${query.toString()}` : '/api/audit';
  return fetchJSON('GET', path);
}

