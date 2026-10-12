import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { ToastContainer } from './components/common/Toast';
import { CommandPalette } from './components/common/CommandPalette';
import { LandingPage } from './components/pages/LandingPage';
import { DashboardPage } from './components/pages/DashboardPage';
import { ProductUploadPage } from './components/pages/ProductUploadPage';
import { CatalogPage } from './components/pages/CatalogPage';
import { ProductMatchingPage } from './components/pages/ProductMatchingPage';
import { CanonicalProductPage } from './components/pages/CanonicalProductPage';
import { PriceComparisonPage } from './components/pages/PriceComparisonPage';
import { DuplicateDetectionPage } from './components/pages/DuplicateDetectionPage';
import { MatchingAnalyticsPage } from './components/pages/MatchingAnalyticsPage';
import { AdminPanelPage } from './components/pages/AdminPanelPage';
import { motion, AnimatePresence } from 'motion/react';

const MainLayout: React.FC = () => {
  const { currentPage } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderActivePage = () => {
    switch (currentPage) {
      case 'landing':
        return <LandingPage />;
      case 'dashboard':
        return <DashboardPage />;
      case 'upload':
        return <ProductUploadPage />;
      case 'catalog':
        return <CatalogPage />;
      case 'matching':
        return <ProductMatchingPage />;
      case 'canonical':
        return <CanonicalProductPage />;
      case 'price-comparison':
        return <PriceComparisonPage />;
      case 'duplicate-detection':
        return <DuplicateDetectionPage />;
      case 'analytics':
        return <MatchingAnalyticsPage />;
      case 'admin':
        return <AdminPanelPage />;
      default:
        return <LandingPage />;
    }
  };

  const isLanding = currentPage === 'landing';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Navbar
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isSidebarOpen={isSidebarOpen}
      />

      <div className="flex flex-1 relative overflow-hidden">
        {/* Render sidebar only for platform views */}
        {!isLanding && (
          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        )}

        <main
          className={`flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 transition-all duration-300 ${
            !isLanding ? 'lg:ml-64' : 'max-w-7xl mx-auto w-full'
          }`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full"
            >
              {renderActivePage()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <ToastContainer />
      <CommandPalette />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
