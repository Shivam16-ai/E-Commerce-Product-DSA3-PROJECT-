import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  UploadCloud,
  FileSpreadsheet,
  FileJson,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Database,
  Cpu,
  Trash2,
  Download,
  Sparkles,
  Eye,
  RefreshCw
} from 'lucide-react';
import { ProductItem } from '../../types';
import { uploadIngestionFile } from '../../lib/api';

// Defined OUTSIDE component to prevent re-creation on every render (fixes duplicate key warning)
const SAMPLE_PARSED_ITEMS: ProductItem[] = [
  {
    id: 'ingest-sample-001',
    title: 'Sony PlayStation 5 Slim Console - Marvel Spider-Man 2 Bundle',
    rawTitle: 'Sony PS5 Slim Console Digital Marvel Spider-Man 2 Included Bundle',
    brand: 'Sony Interactive',
    modelNumber: 'CFI-2000B01X',
    category: 'Gaming Consoles',
    upcOrGtin: '711719570882',
    price: 49990,
    currency: '₹',
    imageUrl: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=400&q=80',
    source: 'Amazon',
    sourceSku: 'AMZ-PS5-SPIDER2',
    rating: 4.9,
    reviewsCount: 5210,
    status: 'Duplicate Pending',
    createdAt: '2026-09-22T00:00:00Z',
    fingerprintHash: 'sha256:88192a01',
    attributes: { Storage: '1TB Custom SSD', Edition: 'Spider-Man 2 Bundle', Resolution: '4K 120Hz' }
  },
  {
    id: 'ingest-sample-002',
    title: 'PlayStation 5 Slim 1TB Disc Edition Console (White/Black)',
    rawTitle: 'Sony PlayStation 5 PS5 Slim 1TB UHD Blu-ray White',
    brand: 'Sony',
    modelNumber: 'CFI-2000A01',
    category: 'Gaming Consoles',
    upcOrGtin: '711719570875',
    price: 49900,
    currency: '₹',
    imageUrl: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=400&q=80',
    source: 'Best Buy',
    sourceSku: 'BB-6563604',
    rating: 4.8,
    reviewsCount: 3900,
    status: 'Duplicate Pending',
    createdAt: '2026-09-22T00:00:00Z',
    fingerprintHash: 'sha256:77291b40',
    attributes: { Storage: '1TB SSD', OpticalDrive: 'Ultra HD Blu-ray', Color: 'White' }
  },
  {
    id: 'ingest-sample-003',
    title: 'Apple AirPods Pro (2nd Generation) with USB-C MagSafe Case',
    rawTitle: 'Apple AirPods Pro 2 Gen with USB-C Wireless Noise Cancelling Earbuds',
    brand: 'Apple',
    modelNumber: 'MTJV3AM/A',
    category: 'Audio',
    upcOrGtin: '195949052521',
    price: 18900,
    currency: '₹',
    imageUrl: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=400&q=80',
    source: 'Walmart',
    sourceSku: 'WM-AIRPODSPRO-USBC',
    rating: 4.8,
    reviewsCount: 16500,
    status: 'Duplicate Pending',
    createdAt: '2026-09-22T00:00:00Z',
    fingerprintHash: 'sha256:399120ff',
    attributes: { Connector: 'USB-C', NoiseCancellation: 'Active ANC + Transparency', Chip: 'Apple H2' }
  }
];

export const ProductUploadPage: React.FC = () => {
  const { addNewIngestedProducts, navigateTo, addToast } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [pipelineStage, setPipelineStage] = useState<string>('Idle');
  const [previewProducts, setPreviewProducts] = useState<ProductItem[]>([]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setIsComplete(false);
    setValidationErrors([]);
    setUploadProgress(10);
    setPipelineStage('1. Uploading file to Python API for schema validation...');
    try {
      setUploadProgress(35);
      setPipelineStage('2. Parsing rows and normalizing product fields...');
      const result = await uploadIngestionFile(file, false); // preview=false (default)
      setUploadProgress(75);
      setPipelineStage('3. Generating fingerprints and validating catalog records...');
      setPreviewProducts(result.products || []);
      setUploadProgress(100);
      setPipelineStage(`4. Validation complete. ${result.parsed ?? (result.products || []).length} records ready for review.`);
      setIsComplete(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not process this file.';
      setValidationErrors([message]);
      setPipelineStage('Upload failed. Check the backend and file format, then retry.');
      setUploadProgress(0);
      addToast('Upload Failed', message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const loadSampleDataset = () => {
    const mockFile = new File(
      [JSON.stringify(SAMPLE_PARSED_ITEMS, null, 2)],
      'sample_ecommerce_catalog_feed.json',
      { type: 'application/json' }
    );
    processSelectedFile(mockFile);
  };

  const handleCommitToCatalog = async () => {
    if (!selectedFile || previewProducts.length === 0) {
      addToast('No Data', 'Please upload and preview a file first.', 'warning');
      return;
    }
    
    setIsCommitting(true);
    try {
      // Call the backend to commit the file
      const result = await uploadIngestionFile(selectedFile, true); // commit=true
      const insertedCount = result.inserted ?? result.parsed ?? previewProducts.length;
      
      if (result.committed && insertedCount > 0) {
        // The backend has persisted the data. Trigger context to reload state.
        // This will be picked up by AppContext's hydration on next render.
        addToast(
          'Commit Complete',
          `Successfully added ${insertedCount} products to the catalog.`,
          'success'
        );
        // Reset the upload form
        handleReset();
        // Navigate to matching page for next step
        setTimeout(() => navigateTo('matching'), 500);
      } else {
        addToast('Commit Failed', 'No products were added to the catalog.', 'warning');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to commit to catalog.';
      addToast('Commit Error', message, 'error');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewProducts([]);
    setUploadProgress(0);
    setIsComplete(false);
    setPipelineStage('Idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadSampleTemplate = (type: 'csv' | 'json') => {
    const content =
      type === 'csv'
        ? `title,brand,model_number,upc_gtin,category,price,currency,source,source_sku,specs\n"Apple iPhone 15 Pro Max 256GB","Apple","MU773LL/A","195949038297","Smartphones",134900,"₹","Amazon","B0CHX1W3","Storage:256GB|Color:Natural Titanium"`
        : JSON.stringify(
            [
              {
                title: 'Sony WH-1000XM5 Headphones',
                brand: 'Sony',
                model_number: 'WH1000XM5/B',
                upc_gtin: '027242923515',
                category: 'Audio',
                price: 29990,
                currency: '₹',
                source: 'Best Buy',
                source_sku: 'BB-6505727',
                attributes: { Color: 'Black', Battery: '30h' }
              }
            ],
            null,
            2
          );

    const blob = new Blob([content], { type: type === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entimatch_sample_template.${type}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="product-upload-page-container" className="space-y-8 pb-16">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Catalog Ingestion Pipeline
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            Batch Product Feed Ingestion
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Upload CSV, Excel (.xlsx), or JSON catalogs. Our pipeline normalizes schemas, computes MinHash signatures, and routes to entity matching.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadSampleTemplate('csv')}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV Template</span>
          </button>
          <button
            onClick={() => downloadSampleTemplate('json')}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON Template</span>
          </button>
        </div>
      </div>

      {/* Upload Zone & Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Drag & Drop Zone */}
        <div className="lg:col-span-8 space-y-4">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-purple-500 bg-purple-500/10 scale-[1.01]'
                : selectedFile
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-slate-300 dark:border-slate-700 hover:border-purple-400 bg-white/60 dark:bg-slate-900/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-purple-500/20">
                <UploadCloud className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedFile ? selectedFile.name : 'Drag and drop your catalog file here'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Supports CSV, Excel (.xlsx), and JSON up to 250MB per batch feed
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> CSV / Excel
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <FileJson className="w-4 h-4 text-amber-500" /> JSON Feed
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-xs"
                >
                  Browse Local Files
                </button>
              </div>
            </div>
          </div>

          {/* Quick Demo Preload Button */}
          <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-white">Need realistic test data? </span>
                <span className="text-slate-600 dark:text-slate-300">
                  Simulate ingestion of Sony PS5 & Apple AirPods cross-seller batch.
                </span>
              </div>
            </div>
            <button
              onClick={loadSampleDataset}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shrink-0 transition-colors"
            >
              Load Sample Feed
            </button>
          </div>
        </div>

        {/* Right Column: Ingestion Status & Validation Guidelines */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-500" />
              Pipeline Progress & Telemetry
            </h3>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Stage Completion</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-purple-600 dark:text-purple-400 font-mono pt-1">
                {pipelineStage}
              </p>
            </div>

            {/* Schema Validation Checklist */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Required Schema Headers
              </span>
              {[
                { name: 'Product Title (title / product_name)', valid: uploadProgress > 0 },
                { name: 'Brand / Manufacturer (brand / make)', valid: uploadProgress > 0 },
                { name: 'Model / MPN / UPC / GTIN', valid: uploadProgress >= 40 },
                { name: 'Retail Price & Currency Code', valid: uploadProgress >= 40 },
                { name: 'Seller Source Name (Amazon, Flipkart)', valid: uploadProgress >= 75 }
              ].map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {h.valid ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                  )}
                  <span className={h.valid ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}>
                    {h.name}
                  </span>
                </div>
              ))}
            </div>

            {selectedFile && (
              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={handleReset}
                  className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset Upload
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Preview Table */}
      {previewProducts.length > 0 && (
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Ready for Entity Resolution
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Parsed Ingestion Preview ({previewProducts.length} Items)
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCommitToCatalog}
                disabled={isCommitting || previewProducts.length === 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
              >
                <span>{isCommitting ? 'Committing...' : 'Commit & Run Entity Matching'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                <tr>
                  <th className="p-3">Product Title & Cleaned Tokens</th>
                  <th className="p-3">Brand</th>
                  <th className="p-3">Model / UPC</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Source Channel</th>
                  <th className="p-3">LSH Fingerprint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {previewProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.imageUrl}
                          alt={p.title}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                            {p.title}
                          </p>
                          <p className="text-[10px] text-slate-400 line-clamp-1 font-mono">
                            Raw: {p.rawTitle}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-medium text-slate-700 dark:text-slate-300">{p.brand}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      <div>{p.modelNumber}</div>
                      <div className="text-[10px] text-purple-600">{p.upcOrGtin}</div>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{p.category}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">₹{p.price.toLocaleString('en-IN')}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                        {p.source}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[10px] text-slate-400">{p.fingerprintHash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
