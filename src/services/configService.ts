/**
 * Remote Configuration Service
 * Manages sensitive configuration like Paystack API key via Firebase RemoteConfig
 * Avoids storing secrets in client code
 */

import { fetchAndActivate, getString, getNumber, getBoolean } from 'firebase/remote-config';
import { remoteConfig } from './firebaseService';

let initPromise: Promise<void> | null = null;

/**
 * Initialize Remote Config
 */
export const initializeConfig = async (): Promise<void> => {
  // Prevent multiple initializations
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Set default values BEFORE fetching
      remoteConfig.defaultConfig = {
        paystack_public_key: '',
        weekly_price: 4700,
        monthly_price: 19700,
        currency: 'KES',
        enable_premium_reports: true,
        enable_payment: true,
        enable_auto_sync: true,
        maintenance_mode: false,
        maintenance_message: 'System is under maintenance. Please try again later.',
        support_email: 'support@myduka.app',
        support_phone: '+254 700 000 000',
        support_whatsapp: 'https://wa.me/254700000000',
      };

      // Set fetch settings BEFORE fetching
      remoteConfig.settings.minimumFetchIntervalMillis = 60000; // 1 minute in development
      remoteConfig.settings.fetchTimeoutMillis = 60000;

      // Fetch and activate
      await fetchAndActivate(remoteConfig);
      console.log('Remote Config initialized successfully');
    } catch (error) {
      console.error('Error initializing Remote Config:', error);
      // Don't throw - allow app to continue with default values
    }
  })();

  return initPromise;
};

/**
 * Get Paystack public key from remote config
 */
export const getPaystackPublicKey = (): string => {
  if (!remoteConfig) {
    console.warn('Remote Config not initialized');
    return '';
  }

  return getString(remoteConfig, 'paystack_public_key') || '';
};

/**
 * Get Paystack secret key from remote config
 */
export const getPaystackSecretKey = (): string => {
  if (!remoteConfig) {
    console.warn('Remote Config not initialized');
    return '';
  }

  return getString(remoteConfig, 'paystack_secret_key') || '';
};

/**
 * Get all payment configuration
 */
export const getPaymentConfig = () => {
  if (!remoteConfig) {
    return {
      paystackPublicKey: '',
      weeklyPrice: 4700,
      monthlyPrice: 19700,
      currency: 'KES',
    };
  }

  return {
    paystackPublicKey: getString(remoteConfig, 'paystack_public_key') || '',
    weeklyPrice: getNumber(remoteConfig, 'weekly_price') || 4700,
    monthlyPrice: getNumber(remoteConfig, 'monthly_price') || 19700,
    currency: getString(remoteConfig, 'currency') || 'KES',
  };
};

/**
 * Get feature flags
 */
export const getFeatureFlags = () => {
  if (!remoteConfig) {
    return {
      enablePremiumReports: true,
      enablePayment: true,
      enableAutoSync: true,
    };
  }

  return {
    enablePremiumReports: getBoolean(remoteConfig, 'enable_premium_reports') ?? true,
    enablePayment: getBoolean(remoteConfig, 'enable_payment') ?? true,
    enableAutoSync: getBoolean(remoteConfig, 'enable_auto_sync') ?? true,
  };
};

/**
 * Get maintenance mode status
 */
export const getMaintenanceStatus = (): {
  isUnderMaintenance: boolean;
  message: string;
} => {
  if (!remoteConfig) {
    return {
      isUnderMaintenance: false,
      message: '',
    };
  }

  return {
    isUnderMaintenance: getBoolean(remoteConfig, 'maintenance_mode') ?? false,
    message: getString(remoteConfig, 'maintenance_message') || 'System is under maintenance. Please try again later.',
  };
};

/**
 * Get support contact information
 */
export const getSupportInfo = () => {
  if (!remoteConfig) {
    return {
      email: 'support@myduka.app',
      phone: '+254 700 000 000',
      whatsapp: 'https://wa.me/254700000000',
    };
  }

  return {
    email: getString(remoteConfig, 'support_email') || 'support@myduka.app',
    phone: getString(remoteConfig, 'support_phone') || '+254 700 000 000',
    whatsapp: getString(remoteConfig, 'support_whatsapp') || 'https://wa.me/254700000000',
  };
};

/**
 * Refresh config from remote (call periodically)
 */
export const refreshConfig = async (): Promise<void> => {
  if (!remoteConfig) {
    await initializeConfig();
    return;
  }

  try {
    await fetchAndActivate(remoteConfig);
  } catch (error) {
    console.error('Error refreshing config:', error);
  }
};
