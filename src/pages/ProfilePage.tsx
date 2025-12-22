import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuthStore } from '../store/authStore';
import {
  User,
  Store,
  LogOut,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Check,
} from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EditProfileModal from '../components/modals/EditProfileModal';
import AddNewShopModal from '../components/modals/AddNewShopModal';
import { RewardsModal } from '../components/modals/RewardsModal';


function ProfilePage() {
  const navigate = useNavigate();
  const { user, shops, currentShop, setCurrentShop, signOut, loading } = useAuthStore();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showAddShopModal, setShowAddShopModal] = useState(false);
  const [showRewards, setShowRewards] = useState(false);


  const handleShopChange = (shopId: string) => {
    const shop = shops.find((s) => s.id === shopId);
    if (shop) {
      setCurrentShop(shop);
      toast.success(`Switched to ${shop.shopName}`);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out');
    } finally {
      setLoggingOut(false);
      setShowLogoutDialog(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <h1 className="text-2xl font-bold text-white">Profile</h1>

      {/* User Info Card */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
            <User size={32} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">
              {currentShop?.ownerName || 'User'}
            </h2>
            <p className="text-sm text-gray-400">Shop Owner</p>
          </div>
        </div>

        <div className="space-y-3">
          {user?.email && (
            <div className="flex items-center gap-3 text-gray-300">
              <Mail size={18} className="text-gray-400" />
              <span className="text-sm">{user.email}</span>
            </div>
          )}

          {user?.phoneNumber && (
            <div className="flex items-center gap-3 text-gray-300">
              <Phone size={18} className="text-gray-400" />
              <span className="text-sm">{user.phoneNumber}</span>
            </div>
          )}

          {currentShop?.location && (
            <div className="flex items-center gap-3 text-gray-300">
              <MapPin size={18} className="text-gray-400" />
              <span className="text-sm">{currentShop.location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Current Shop Card */}
      {currentShop && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Store size={20} className="text-gray-400" />
            <h3 className="font-semibold text-white">Current Shop</h3>
          </div>

          <div className="bg-gray-700 rounded-lg p-4 border-2 border-blue-500">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <p className="font-medium text-white">{currentShop.shopName}</p>
                <p className="text-sm text-gray-400 mt-1">{currentShop.location}</p>
              </div>
              <div
                className={`px-2 py-1 rounded text-xs font-medium ${
                  currentShop.status === 'active'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}
              >
                {currentShop.status}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-600">
              <div>
                <p className="text-xs text-gray-400">Business Type</p>
                <p className="text-sm text-white capitalize">{currentShop.businessType}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Phone</p>
                <p className="text-sm text-white">{currentShop.phone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Shop ID</p>
                <p className="text-sm text-white">{currentShop.id}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
            <button
              onClick={() => setShowRewards(true)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Store size={20} className="text-gray-400" />
                <span className="text-white">Reward Customer</span>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {/* All Shops */}
      {shops.length > 1 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Store size={20} className="text-gray-400" />
            <h3 className="font-semibold text-white">Your Shops ({shops.length})</h3>
          </div>

          <div className="space-y-2">
            {shops.map((shop) => (
              <button
                key={shop.id}
                onClick={() => handleShopChange(shop.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  currentShop?.id === shop.id
                    ? 'bg-blue-500/10 border-blue-500/50'
                    : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{shop.shopName}</p>
                      {currentShop?.id === shop.id && (
                        <Check size={16} className="text-blue-400" />
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">{shop.location}</p>
                  </div>
                  <ChevronRight size={20} className="text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Account Actions */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
        <button
          onClick={() => setShowEditProfileModal(true)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <User size={20} className="text-gray-400" />
            <span className="text-white">Edit Profile</span>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        <button
          onClick={() => setShowAddShopModal(true)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Store size={20} className="text-gray-400" />
            <span className="text-white">Add New Shop</span>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        
      </div>

      {/* Logout Button */}
      <button
        onClick={() => setShowLogoutDialog(true)}
        disabled={loggingOut}
        className="w-full p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 rounded-lg flex items-center justify-center gap-2 text-red-400 font-medium transition-colors disabled:opacity-50"
      >
        {loggingOut ? (
          <>
            <LoadingSpinner size="sm" />
            Logging Out...
          </>
        ) : (
          <>
            <LogOut size={20} />
            Log Out
          </>
        )}
      </button>

      {/* App Info */}
      <div className="text-center text-gray-400 text-sm pt-4">
        <p>MyDuka v10.998.0.0</p>
        <p className="mt-1">Shop Management Made Easy</p>
      </div>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLogoutDialog}
        title="Log Out"
        message="Are you sure you want to log out?"
        confirmText="Log Out"
        cancelText="Cancel"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutDialog(false)}
        variant="danger"
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
        onSuccess={() => {
          setShowEditProfileModal(false);
          // Profile data will be automatically updated through auth store
        }}
      />

      <RewardsModal
        isOpen={showRewards}
        onClose={() => setShowRewards(false)}
        shopId={currentShop!.id}
        shopName={currentShop!.shopName}
      />

      {/* Add New Shop Modal */}
      <AddNewShopModal
        isOpen={showAddShopModal}
        onClose={() => setShowAddShopModal(false)}
        onSuccess={() => {
          setShowAddShopModal(false);
          // Shops will be reloaded on next auth check
        }}
      />
    </div>
  );
}

export default ProfilePage;
