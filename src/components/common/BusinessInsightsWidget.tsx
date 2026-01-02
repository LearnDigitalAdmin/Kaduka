import { AlertTriangle, TrendingUp, Lightbulb, Award, ChevronRight } from 'lucide-react';
import { BusinessInsight } from '../../services/insightsService';

interface BusinessInsightsWidgetProps {
  insights: BusinessInsight[];
  plan: 'weekly' | 'monthly';
  loading?: boolean;
}

function BusinessInsightsWidget({ insights, plan, loading }: BusinessInsightsWidgetProps) {
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return AlertTriangle;
      case 'opportunity':
        return TrendingUp;
      case 'optimization':
        return Lightbulb;
      case 'achievement':
        return Award;
      default:
        return Lightbulb;
    }
  };

  const getInsightColor = (type: string, priority: string) => {
    if (type === 'achievement') return 'from-green-500 to-emerald-500';
    
    switch (priority) {
      case 'urgent':
        return 'from-red-500 to-red-600';
      case 'high':
        return 'from-orange-500 to-orange-600';
      case 'medium':
        return 'from-yellow-500 to-yellow-600';
      default:
        return 'from-blue-500 to-blue-600';
    }
  };

  const getInsightBg = (type: string, priority: string) => {
    if (type === 'achievement') return 'bg-green-500/10 border-green-500/30';
    
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/10 border-red-500/30';
      case 'high':
        return 'bg-orange-500/10 border-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/30';
      default:
        return 'bg-blue-500/10 border-blue-500/30';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'warning':
        return '⚠️ Warning';
      case 'opportunity':
        return '💰 Opportunity';
      case 'optimization':
        return '⚡ Optimization';
      case 'achievement':
        return '🎉 Achievement';
      default:
        return '💡 Insight';
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-700 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="text-center py-8">
          <Lightbulb size={48} className="mx-auto text-gray-400 mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">No Insights Available</h3>
          <p className="text-sm text-gray-400">
            Add more sales and expense data to generate business insights.
          </p>
        </div>
      </div>
    );
  }

  // Group insights by type
  const warnings = insights.filter(i => i.type === 'warning');
  const opportunities = insights.filter(i => i.type === 'opportunity');
  const optimizations = insights.filter(i => i.type === 'optimization');
  const achievements = insights.filter(i => i.type === 'achievement');

  return (
    <div className="space-y-4">
      {/* Header with counts */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Business Insights</h3>
            <p className="text-sm text-gray-400">
              {plan === 'monthly' ? 'Advanced insights & recommendations' : 'Basic insights'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {warnings.length > 0 && (
              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded font-medium">
                {warnings.length} Alert{warnings.length !== 1 ? 's' : ''}
              </span>
            )}
            {opportunities.length > 0 && (
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded font-medium">
                {opportunities.length} Opportunity
              </span>
            )}
          </div>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 bg-red-500/10 rounded">
            <p className="text-2xl font-bold text-red-400">{warnings.length}</p>
            <p className="text-xs text-gray-400">Warnings</p>
          </div>
          <div className="text-center p-2 bg-green-500/10 rounded">
            <p className="text-2xl font-bold text-green-400">{opportunities.length}</p>
            <p className="text-xs text-gray-400">Opportunities</p>
          </div>
          <div className="text-center p-2 bg-yellow-500/10 rounded">
            <p className="text-2xl font-bold text-yellow-400">{optimizations.length}</p>
            <p className="text-xs text-gray-400">Optimizations</p>
          </div>
          <div className="text-center p-2 bg-blue-500/10 rounded">
            <p className="text-2xl font-bold text-blue-400">{achievements.length}</p>
            <p className="text-xs text-gray-400">Achievements</p>
          </div>
        </div>
      </div>

      {/* Insights list */}
      <div className="space-y-3">
        {insights.map((insight, idx) => {
          const Icon = getInsightIcon(insight.type);
          const colorClass = getInsightColor(insight.type, insight.priority);
          const bgClass = getInsightBg(insight.type, insight.priority);

          return (
            <div
              key={insight.id || idx}
              className={`${bgClass} border rounded-lg p-4 transition-all hover:scale-[1.02]`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClass} flex-shrink-0`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-400 uppercase">
                        {getTypeLabel(insight.type)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                          insight.priority === 'urgent'
                            ? 'bg-red-500 text-white'
                            : insight.priority === 'high'
                            ? 'bg-orange-500 text-white'
                            : insight.priority === 'medium'
                            ? 'bg-yellow-500 text-white'
                            : 'bg-blue-500 text-white'
                        }`}
                      >
                        {insight.priority}
                      </span>
                    </div>
                    <h4 className="text-white font-semibold text-base mb-1">{insight.title}</h4>
                    <p className="text-sm text-gray-300 mb-2">{insight.description}</p>
                  </div>
                </div>
              </div>

              {/* Impact */}
              <div className="bg-gray-900/50 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Expected Impact</p>
                    <p className="text-sm font-semibold text-white">{insight.impact}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </div>

              {/* Action */}
              <div className="flex items-start gap-2 p-3 bg-gray-900/30 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1">Recommended Action</p>
                  <p className="text-sm text-white font-medium">{insight.action}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Plan upgrade prompt for weekly users */}
      {plan === 'weekly' && (
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Award size={24} className="text-blue-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h4 className="text-white font-semibold mb-1">Unlock Advanced Insights</h4>
              <p className="text-sm text-gray-300 mb-3">
                Upgrade to Monthly for peak hour analysis, day optimization, product scoring, and more.
              </p>
              <ul className="text-xs text-gray-400 space-y-1 mb-3">
                <li>🕐 Peak hour staffing recommendations</li>
                <li>📅 Day-of-week optimization strategies</li>
                <li>🏆 Product performance scoring</li>
                <li>💡 Advanced pricing insights</li>
              </ul>
              <button className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                Upgrade to Monthly Plan →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BusinessInsightsWidget;
