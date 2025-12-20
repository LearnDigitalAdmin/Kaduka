import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, DollarSign, Package, FileText, User } from 'lucide-react';

interface NavItem {
  path: string;
  icon: typeof Home;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/sales', icon: ShoppingCart, label: 'Sales' },
  { path: '/expenses', icon: DollarSign, label: 'Expenses' },
  { path: '/stock', icon: Package, label: 'Stock' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/profile', icon: User, label: 'Profile' },
];

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? 'text-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Icon size={20} />
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
