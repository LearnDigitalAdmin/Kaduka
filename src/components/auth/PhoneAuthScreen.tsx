import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuthStore } from '../../store/authStore';
import { Smartphone } from 'lucide-react';
import LoadingSpinner from '../common/LoadingSpinner';

function PhoneAuthScreen() {
  const navigate = useNavigate();
  const { signInWithPhone, verifyPhoneCode, setupRecaptcha, loading, confirmationResult } = useAuthStore();
  const [phoneNumber, setPhoneNumber] = useState('+254');
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');

  useEffect(() => {
    setupRecaptcha('recaptcha-container');
  }, [setupRecaptcha]);

  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!phoneNumber.trim() || phoneNumber.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    try {
      await signInWithPhone(phoneNumber);
      toast.success('Verification code sent!');
      setStep('code');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send verification code');
    }
  };

  const handleCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!verificationCode.trim() || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    try {
      await verifyPhoneCode(verificationCode);
      toast.success('Phone verified successfully!');
      navigate('/home');
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify code');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-blue-500/10 rounded-full mb-4">
            <Smartphone className="w-12 h-12 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Phone Verification</h1>
          <p className="text-gray-400">
            {step === 'phone' ? 'Enter your phone number' : 'Enter verification code'}
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
          {step === 'phone' ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-6">Enter Phone Number</h2>

              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+254712345678"
                      className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loading}
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    Include country code (e.g., +254 for Kenya)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Sending Code...
                    </>
                  ) : (
                    'Send Verification Code'
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-white mb-6">Enter Verification Code</h2>

              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg text-blue-400 text-sm">
                Code sent to {phoneNumber}
              </div>

              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    6-Digit Code
                  </label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-2xl tracking-widest placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Code'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="w-full py-2 text-gray-400 hover:text-white text-sm transition-colors"
                  disabled={loading}
                >
                  Change phone number
                </button>
              </form>
            </>
          )}

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Have email account?{' '}
              <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
                Sign In with Email
              </Link>
            </p>
          </div>
        </div>

        {/* Recaptcha Container */}
        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
}

export default PhoneAuthScreen;
