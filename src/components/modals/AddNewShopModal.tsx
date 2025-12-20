import { useState } from 'react';
import { toast } from 'react-toastify';
import { X, Store, MapPin, User, Phone } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { createShop } from '../../services/shopService';
import LoadingSpinner from '../common/LoadingSpinner';

interface AddNewShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function AddNewShopModal({ isOpen, onClose, onSuccess }: AddNewShopModalProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);

  // Form state
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [businessType, setBusinessType] = useState('retail');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shopName.trim() || !ownerName.trim() || !location.trim() || !phone.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    try {
      setLoading(true);

      await createShop({
        shopName,
        ownerName,
        location,
        phone,
        email: user.email || '',
        businessType,
        createdVia: 'app',
        status: 'active',
        firebaseUid: user.uid,
        nationalId: '',
        totalEmployees: 1,
        isAuthSetup: true,
      });

      toast.success('New shop created successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating shop:', error);
      toast.error(error.message || 'Failed to create shop');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      // Reset form
      setShopName('');
      setOwnerName('');
      setLocation('');
      setPhone('');
      setBusinessType('retail');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Add New Shop</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          {/* Shop Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
              <Store size={16} />
              Shop Name
            </label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="My New Shop"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {/* Owner Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
              <User size={16} />
              Owner Name
            </label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
              <MapPin size={16} />
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Street"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
              <Phone size={16} />
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254712345678"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {/* Business Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Business Type</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="retail">Retail Shop</option>
              <option value="wholesale">Wholesale</option>
              <option value="restaurant">Restaurant/Cafe</option>
              <option value="services">Services</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Creating...
                </>
              ) : (
                'Create Shop'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddNewShopModal;
