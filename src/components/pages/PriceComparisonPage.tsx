import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  IndianRupee,
  TrendingDown,
  Store,
  Star,
  Truck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  ArrowRight,
  SlidersHorizontal
} from 'lucide-react';
import { SellerOffer } from '../../types';

export const PriceComparisonPage: React.FC = () => {
  const { canonicalProducts, selectedCanonicalId, setSelectedCanonicalId, navigateTo } = useApp();

  const currentProduct =
    canonicalProducts.find((p) => (p.canonicalId || p.id) === selectedCanonicalId) ||
    canonicalProducts[0];

  const offers: SellerOffer[] = currentProduct?.sellerOffers || [];
  const sortedOffers = [...offers].sort((a, b) => a.price - b.price);
  const lowestOffer = sortedOffers[0];
  const highestOffer = sortedOffers[sortedOffers.length - 1];
  const priceDispersion = highestOffer && lowestOffer ? highestOffer.price - lowestOffer.price : 0;
  const spreadPercentage = lowestOffer ? ((priceDispersion / lowestOffer.price) * 100).toFixed(1) : '0';

  return (
    <div id="price-comparison-page-container" className="space-y-8 pb-16">
      {/* Top Header */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Cross-Seller Price Intelligence Engine
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            Price Comparison & Buy-Box Arbitrage
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Identify margin opportunities, live price dispersion, and shipping advantages for identical canonical entities.
          </p>
        </div>

        {/* Product selector dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Comparing:</span>
          <select
            value={selectedCanonicalId}
            onChange={(e) => setSelectedCanonicalId(e.target.value)}
            className="text-xs py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden max-w-[280px]"
          >
            {canonicalProducts.map((p) => (
              <option key={p.canonicalId || p.id} value={p.canonicalId || p.id}>
                {p.title.substring(0, 36)}...
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentProduct && (
        <>
          {/* Target Product Summary Banner */}
          <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img
                src={currentProduct.imageUrl}
                alt={currentProduct.title}
                className="w-20 h-20 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                  Canonical Master SKU: {currentProduct.modelNumber}
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">
                  {currentProduct.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <span>UPC: {currentProduct.upcOrGtin}</span>
                  <span>•</span>
                  <span>{sortedOffers.length} Active Seller Listings Tracked</span>
                </div>
              </div>
            </div>

            {/* Price Spread KPI Pill */}
            <div className="flex flex-wrap items-center gap-3 bg-purple-50/50 dark:bg-purple-950/30 p-4 rounded-xl border border-purple-200 dark:border-purple-800/80">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Market Spread</span>
                <span className="text-xl font-black text-purple-600 dark:text-purple-400">
                  ₹{priceDispersion.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="border-l border-purple-200 dark:border-purple-800 pl-3">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Dispersion %</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {spreadPercentage}%
                </span>
              </div>
            </div>
          </div>

          {/* Seller Comparison Cards Grid */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Live Seller Comparison Cards
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {sortedOffers.map((offer, idx) => {
                const isBuyBox = idx === 0;
                const priceDiff = offer.price - lowestOffer.price;

                return (
                  <div
                    key={offer.id}
                    className={`rounded-2xl p-5 flex flex-col justify-between transition-all backdrop-blur-xl border ${
                      isBuyBox
                        ? 'bg-gradient-to-b from-emerald-500/10 via-white to-white dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900 border-emerald-500/50 shadow-md ring-2 ring-emerald-500/20'
                        : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800/80 shadow-xs'
                    }`}
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-purple-600 dark:text-purple-400 font-bold">
                            <Store className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {offer.sellerName}
                            </span>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span>{offer.sellerRating}</span>
                            </div>
                          </div>
                        </div>

                        {isBuyBox && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                            Buy-Box #1
                          </span>
                        )}
                      </div>

                      {/* Pricing Block */}
                      <div className="py-4 space-y-1">
                        <span className="text-[10px] text-slate-400 font-medium">Offered Price</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                            ₹{offer.price.toLocaleString('en-IN')}
                          </span>
                          {offer.originalPrice > offer.price && (
                            <span className="text-xs text-slate-400 line-through">
                              ₹{offer.originalPrice.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>

                        {offer.originalPrice > offer.price && (
                          <span className="inline-block text-[11px] font-bold text-emerald-600">
                            Save ₹{(offer.originalPrice - offer.price).toLocaleString('en-IN')}
                          </span>
                        )}

                        {!isBuyBox && (
                          <p className="text-[11px] text-rose-500 font-medium">
                            +₹{priceDiff.toLocaleString('en-IN')} vs lowest deal
                          </p>
                        )}
                      </div>

                      {/* Terms & Fulfillment */}
                      <div className="space-y-2 py-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Availability:</span>
                          <span
                            className={`font-semibold ${
                              offer.availability === 'In Stock' ? 'text-emerald-600' : 'text-amber-500'
                            }`}
                          >
                            {offer.availability}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Shipping:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {offer.shippingDays}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Condition:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {offer.condition}
                          </span>
                        </div>
                      </div>
                    </div>

                    <a
                      href={offer.listingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`w-full mt-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        isBuyBox
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <span>Visit {offer.sellerName} Store</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
