import React, { useState } from 'react';

/**
 * AccountabilityBanner Component
 * 
 * Displays a warning banner when there are overdue accountability items.
 * Renders nothing when there are no overdue items.
 * 
 * Features:
 * - Red warning color scheme for visibility
 * - ARIA attributes for accessibility
 * - Priority-based sorting (critical > high > medium > low)
 * - Displays up to 3 items with "and X more" indicator
 * - Dismissible with optional callback
 * - Responsive design with text truncation
 */

export interface AccountabilityItem {
  id: string;
  title: string;
  assignee_id?: string;
  status: string;
  due_date: string;
  type?: 'issue' | 'project' | 'doc' | 'week' | 'team';
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AccountabilityBannerProps {
  items?: AccountabilityItem[];
  onDismiss?: () => void;
  maxDisplay?: number;
}

const AccountabilityBanner: React.FC<AccountabilityBannerProps> = ({
  items,
  onDismiss,
  maxDisplay = 3,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't render if dismissed, no items, or empty array
  if (isDismissed || !items || items.length === 0) {
    return null;
  }

  // Sort items by priority (critical > high > medium > low)
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const sortedItems = [...items].sort((a, b) => {
    const aPriority = a.priority ? priorityOrder[a.priority] : 999;
    const bPriority = b.priority ? priorityOrder[b.priority] : 999;
    return aPriority - bPriority;
  });

  // Limit displayed items
  const displayedItems = sortedItems.slice(0, maxDisplay);
  const remainingCount = sortedItems.length - maxDisplay;

  // Handle dismiss
  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority?: string): string => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get type badge color
  const getTypeColor = (type?: string): string => {
    switch (type) {
      case 'issue':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'project':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'doc':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'week':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'team':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const itemCount = items.length;
  const itemText = itemCount === 1 ? 'overdue item' : 'overdue items';

  return (
    <div
      role="alert"
      aria-live="polite"
      className="bg-red-50 border border-red-200 rounded-lg shadow-sm p-4 mb-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <svg
              className="w-5 h-5 text-red-700 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <h3 className="text-red-900 font-semibold">
              You have {itemCount} {itemText}
            </h3>
          </div>

          <ul className="space-y-2" role="list">
            {displayedItems.map((item) => (
              <li
                key={item.id}
                className="text-red-700 text-sm flex items-start gap-2"
              >
                <span className="text-red-500 mt-0.5">•</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{item.title}</span>
                    {item.type && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getTypeColor(
                          item.type
                        )}`}
                      >
                        {item.type}
                      </span>
                    )}
                    {item.priority && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(
                          item.priority
                        )}`}
                      >
                        {item.priority}
                      </span>
                    )}
                  </div>
                  <div className="text-red-600 text-xs mt-1">
                    Due: {formatDate(item.due_date)}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {remainingCount > 0 && (
            <p className="text-red-700 text-sm mt-2 ml-5">
              and {remainingCount} more...
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="ml-4 text-red-700 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default AccountabilityBanner;
