import { ReactNode } from 'react';
import BottomNav from './BottomNav';
import { useAuthStore } from '../../store/authStore';

interface MainLayoutProps {
  children: ReactNode;
}

function MainLayout({ children }: MainLayoutProps) {
  const { currentShop } = useAuthStore();

  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">
                {currentShop?.shopName || 'MyDuka'}
              </h1>
              {currentShop?.location && (
                <p className="text-xs text-gray-400">{currentShop.location}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                currentShop?.status === 'active'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {currentShop?.status || 'pending'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

export default MainLayout;
