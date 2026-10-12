export type PageId =
  | 'landing'
  | 'dashboard'
  | 'upload'
  | 'catalog'
  | 'matching'
  | 'canonical'
  | 'price-comparison'
  | 'duplicate-detection'
  | 'analytics'
  | 'admin';

export interface SellerOffer {
  id: string;
  sellerId: string;
  sellerName: 'Amazon' | 'Flipkart' | 'Walmart' | 'Best Buy' | 'Target' | 'eBay';
  sellerRating: number;
  sellerReviewCount: number;
  price: number;
  originalPrice: number;
  currency: string;
  availability: 'In Stock' | 'Only 2 Left' | 'Pre-Order' | 'Out of Stock';
  shippingCost: number;
  shippingDays: string;
  listingUrl: string;
  sku: string;
  condition: 'Brand New' | 'Refurbished - Like New' | 'Open Box';
  isBuyBoxWinner?: boolean;
}

export interface ProductAttribute {
  name: string;
  value: string;
  normalizedValue?: string;
  confidence: number;
}

export interface ProductItem {
  id: string;
  canonicalId?: string;
  title: string;
  rawTitle?: string;
  brand: string;
  modelNumber: string;
  category: string;
  subCategory?: string;
  upcOrGtin: string;
  price: number;
  currency: string;
  imageUrl: string;
  source: 'Amazon' | 'Flipkart' | 'Walmart' | 'Best Buy' | 'Target' | 'eBay' | 'Manual Ingestion';
  sourceSku: string;
  rating: number;
  reviewsCount: number;
  status: 'Canonical Master' | 'Matched' | 'Duplicate Pending' | 'Unmatched';
  matchScore?: number;
  sellerOffers?: SellerOffer[];
  attributes: Record<string, string>;
  createdAt: string;
  fingerprintHash: string;
}

export interface MatchCandidatePair {
  id: string;
  primaryProduct: ProductItem;
  secondaryProduct: ProductItem;
  productIdA: string;
  productIdB: string;
  overallScore: number; // 0 - 100
  overallScoreNorm: number; // 0 - 1
  titleScore: number;
  brandScore: number;
  attributeScore: number;
  imageScore: number;
  featureScores?: {
    upc: number;
    model: number;
    brand: number;
    title: number;
    attrs: number;
  };
  confidenceLevel: 'High' | 'Medium' | 'Low';
  matchStatus: 'Pending Review' | 'Approved' | 'Rejected' | 'Merged';
  detectedReason: string;
  timestamp: string;
  // Phase 2 explainability fields
  positiveEvidence?: string[];
  conflictingEvidence?: string[];
  explanation?: string;
  recommendedAction?: 'auto_candidate' | 'review' | 'reject';
  // Review workflow
  reviewerDecision?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewerNotes?: string;
  manualOverride?: boolean;
  previousStatus?: string;
  runId?: string;
}

export interface MatchRunMetadata {
  runId: string;
  timestamp: string;
  productsScanned: number;
  candidatesGenerated: number;
  pairsAboveReview: number;
  clustersFound: number;
  status: string;
  message?: string;
}

export interface MatchingSettings {
  high_confidence_threshold: number;
  review_threshold: number;
  reject_below: number;
  weight_upc: number;
  weight_model: number;
  weight_brand: number;
  weight_title: number;
  weight_attrs: number;
  conflict_model_penalty: number;
  conflict_upc_penalty: number;
  unknown_brand_penalty: number;
}

export interface DuplicateCluster {
  id: string;
  canonicalTitle: string;
  brand: string;
  category: string;
  items: ProductItem[];
  averageSimilarity: number;
  status: 'Active Redundancy' | 'Resolved' | 'Under Audit';
  potentialSavingsEstimate: number;
}

export interface SystemNotification {
  id: string;
  title: string;
  description: string;
  type: 'match' | 'duplicate' | 'price' | 'system';
  timestamp: string;
  read: boolean;
  actionPage?: PageId;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  target: string;
  details: string;
  type:
    | 'merge'
    | 'split'
    | 'attach'
    | 'detach'
    | 'create'
    | 'update'
    | 'archive'
    | 'undo'
    | 'override'
    | 'rule_change'
    | 'import'
    | 'verification';
  entityIds?: string[];
  reason?: string;
  beforeSnapshot?: any;
  afterSnapshot?: any;
  correlationId?: string;
}

export interface CanonicalProduct {
  id: string;
  title: string;
  normalizedTitle: string;
  brand: string;
  modelNumber: string;
  category: string;
  subCategory?: string;
  upcOrGtin: string;
  attributes: Record<string, string>;
  variants?: any[];
  status: 'active' | 'merged' | 'archived' | 'Canonical Master';
  sourceProductIds: string[];
  sellerOffers?: SellerOffer[];
  price: number;
  currency: string;
  imageUrl: string;
  rating: number;
  reviewsCount: number;
  mergedIntoCanonicalId?: string | null;
  conflicts?: Record<string, any>;
  version: number;
  createdAt: string;
  updatedAt: string;
  _redirectedFrom?: string;
}

export interface CanonicalMergeRequest {
  survivingCanonicalId: string;
  mergedCanonicalIds: string[];
  confirmConflicts?: boolean;
  reviewer?: string;
  reason?: string;
}

export interface CanonicalSplitRequest {
  sourceProductIds: string[];
  newCanonicalTitle?: string;
  destinationCanonicalId?: string;
  reviewer?: string;
  reason?: string;
}

export interface CanonicalUndoMergeRequest {
  mergedCanonicalId?: string;
  reviewer?: string;
  reason?: string;
}

export interface SourceAttachRequest {
  sourceProductId: string;
  reviewer?: string;
  reason?: string;
}

export interface SourceDetachRequest {
  sourceProductId: string;
  reviewer?: string;
  reason?: string;
}

export interface SellerFeedConfig {
  id: string;
  name: string;
  logo: string;
  endpoint: string;
  active: boolean;
  lastSync: string;
  productsIngested: number;
  matchRate: number;
  healthStatus: 'Healthy' | 'Degraded' | 'Offline';
}

