import { useState } from 'react';
import { toast } from 'react-toastify';
import { X, Mail, Phone, MapPin, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import LoadingSpinner from '../common/LoadingSpinner';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function EditProfileModal({ isOpen, onClose, onSuccess }: EditProfileModalProps) {
  const { user, currentShop, updateShop } = useAuthStore();
  const [loading, setLoading] = useState(false);

  // Form state - pre-populate with current values
  const [ownerName, setOwnerName] = useState(currentShop?.ownerName || '');
  const [location, setLocation] = useState(currentShop?.location || '');
  const [phone, setPhone] = useState(currentShop?.phone || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ownerName.trim() || !location.trim() || !phone.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!currentShop) {
      toast.error('No shop selected');
      return;
    }

    try {
      setLoading(true);

      // Update shop with new values
      await updateShop(currentShop.id, {
        ownerName,
        location,
        phone,
      });

      toast.success('Profile updated successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !currentShop) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Edit Profile</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
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
              placeholder="Your name"
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

          {/* Email Display (Read-only) */}
          <div>
            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
              <Mail size={16} />
              Email Address
            </label>
            <div className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-400 text-sm">
              {user?.email}
            </div>
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
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
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfileModal;
