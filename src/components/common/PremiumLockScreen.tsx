import { Lock, TrendingUp, Users, Award, Crown } from 'lucide-react';

interface PremiumLockScreenProps {
  feature: 'rewards' | 'stockout-alerts' | 'forecasting' | 'benchmarks';
  onUpgrade: () => void;
}

const FEATURE_INFO = {
  rewards: {
    icon: Award,
    title: 'Customer Rewards System',
    description: 'Build customer loyalty with ShopCoins rewards program',
    benefits: [
      'Track customer purchases and visits',
      'Award coins based on spending and payment methods',
      'Redeem coins for discounts',
      'Customer levels and VIP status',
      'Increase repeat business by 40%+',
    ],
    color: 'from-purple-500 to-pink-500',
  },
  'stockout-alerts': {
    icon: TrendingUp,
    title: 'Smart Stockout Alerts',
    description: 'Never run out of stock again with predictive alerts',
    benefits: [
      'Predict when products will run out',
      'Get alerts 7 days in advance',
      'Recommended reorder quantities',
      'Prevent lost sales from stockouts',
      'Save thousands in lost revenue',
    ],
    color: 'from-orange-500 to-red-500',
  },
  forecasting: {
    icon: TrendingUp,
    title: 'Sales Forecasting',
    description: 'Predict future sales and plan ahead',
    benefits: [
      'Forecast next week and month sales',
      'Identify sales trends early',
      'Plan inventory proactively',
      'Optimize cash flow',
      'Make data-driven decisions',
    ],
    color: 'from-blue-500 to-cyan-500',
  },
  benchmarks: {
    icon: Users,
    title: 'Competitive Benchmarks',
    description: 'See how you compare to similar shops',
    benefits: [
      'Compare profit margins',
      'See industry averages',
      'Find your ranking',
      'Get improvement recommendations',
      'Stay competitive',
    ],
    color: 'from-green-500 to-emerald-500',
  },
};

function PremiumLockScreen({ feature, onUpgrade }: PremiumLockScreenProps) {
  const info = FEATURE_INFO[feature];
  const Icon = info.icon;

  return (
    <div className="relative min-h-[400px] flex items-center justify-center p-6">
      {/* Blurred background effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 backdrop-blur-sm rounded-lg" />

      {/* Lock overlay */}
      <div className="relative z-10 max-w-lg w-full text-center">
        {/* Premium badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full mb-6">
          <Crown size={20} className="text-white" />
          <span className="text-white font-bold text-sm">PREMIUM FEATURE</span>
        </div>

        {/* Icon */}
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br ${info.color} mb-6`}>
          <Icon size={40} className="text-white" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-3">{info.title}</h2>
        <p className="text-gray-400 mb-6">{info.description}</p>

        {/* Benefits */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 mb-6 text-left">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
            What You'll Get:
          </h3>
          <ul className="space-y-3">
            {info.benefits.map((benefit, idx) => (
              <li key={idx} className="flex items-start gap-3 text-gray-300">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-sm">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pricing */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Weekly Plan</p>
              <p className="text-xl font-bold text-white">KES 47</p>
            </div>
            <div className="w-px h-10 bg-gray-700" />
            <div>
              <p className="text-xs text-gray-400 mb-1">Monthly Plan</p>
              <div className="flex items-baseline gap-1">
                <p className="text-xl font-bold text-white">KES 197</p>
                <span className="text-xs text-green-400">Save 58%</span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onUpgrade}
          className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2"
        >
          <Lock size={20} />
          Unlock Premium Features
        </button>

        <p className="text-xs text-gray-500 mt-4">
          No recurring charges. Cancel anytime.
        </p>
      </div>
    </div>
  );
}

export default PremiumLockScreen;
