import React from 'react';
import AccountabilityBanner, { AccountabilityItem } from './AccountabilityBanner';

/**
 * Example usage of the AccountabilityBanner component
 * 
 * This file demonstrates how to use the AccountabilityBanner component
 * with various configurations and data scenarios.
 */

export const AccountabilityBannerExample: React.FC = () => {
  // Example 1: Basic usage with overdue items
  const overdueItems: AccountabilityItem[] = [
    {
      id: '1',
      title: 'Complete Q1 Performance Review',
      assignee_id: 'user-123',
      status: 'overdue',
      due_date: '2024-01-15',
      type: 'doc',
      priority: 'high',
    },
    {
      id: '2',
      title: 'Submit Weekly Report',
      assignee_id: 'user-123',
      status: 'overdue',
      due_date: '2024-01-20',
      type: 'week',
      priority: 'medium',
    },
    {
      id: '3',
      title: 'Fix Critical Bug in Production',
      assignee_id: 'user-456',
      status: 'overdue',
      due_date: '2024-01-10',
      type: 'issue',
      priority: 'critical',
    },
    {
      id: '4',
      title: 'Update Project Documentation',
      assignee_id: 'user-789',
      status: 'overdue',
      due_date: '2024-01-18',
      type: 'project',
      priority: 'low',
    },
  ];

  // Example 2: Empty array (banner won't render)
  const noOverdueItems: AccountabilityItem[] = [];

  // Example 3: With dismiss callback
  const handleDismiss = () => {
    console.log('Banner dismissed by user');
    // You could save this to localStorage or send to analytics
  };

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          AccountabilityBanner Examples
        </h2>
        <p className="text-gray-700 mb-6">
          The AccountabilityBanner component displays overdue accountability items
          with priority-based sorting and a dismissible interface.
        </p>
      </div>

      {/* Example 1: With overdue items */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Example 1: With Overdue Items
        </h3>
        <p className="text-gray-600 mb-4">
          Shows 4 overdue items, sorted by priority (critical first). Only displays
          the first 3 items with "and 1 more..." indicator.
        </p>
        <AccountabilityBanner
          items={overdueItems}
          onDismiss={handleDismiss}
          maxDisplay={3}
        />
      </section>

      {/* Example 2: No overdue items */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Example 2: No Overdue Items
        </h3>
        <p className="text-gray-600 mb-4">
          When there are no overdue items, the banner renders nothing (null).
        </p>
        <AccountabilityBanner items={noOverdueItems} />
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-gray-500 italic">
          (No banner displayed - component returns null)
        </div>
      </section>

      {/* Example 3: Custom maxDisplay */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Example 3: Custom maxDisplay (show 2 items)
        </h3>
        <p className="text-gray-600 mb-4">
          You can customize how many items to display using the maxDisplay prop.
        </p>
        <AccountabilityBanner
          items={overdueItems}
          maxDisplay={2}
          onDismiss={() => console.log('Custom maxDisplay banner dismissed')}
        />
      </section>

      {/* Example 4: Items without optional fields */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Example 4: Items Without Optional Fields
        </h3>
        <p className="text-gray-600 mb-4">
          The component gracefully handles items without type or priority.
        </p>
        <AccountabilityBanner
          items={[
            {
              id: '5',
              title: 'Minimal Item (no type or priority)',
              assignee_id: 'user-999',
              status: 'overdue',
              due_date: '2024-01-25',
            },
          ]}
        />
      </section>

      {/* Example 5: Single item (singular text) */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Example 5: Single Overdue Item
        </h3>
        <p className="text-gray-600 mb-4">
          When there's only one overdue item, the banner uses singular text
          ("1 overdue item" instead of "items").
        </p>
        <AccountabilityBanner
          items={[overdueItems[0]]}
          onDismiss={() => console.log('Single item banner dismissed')}
        />
      </section>

      {/* Usage Notes */}
      <section className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Usage Notes
        </h3>
        <ul className="space-y-2 text-gray-700">
          <li className="flex items-start">
            <span className="text-blue-600 mr-2">•</span>
            <span>
              <strong>Automatic Sorting:</strong> Items are automatically sorted by
              priority (critical → high → medium → low)
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 mr-2">•</span>
            <span>
              <strong>Dismissible:</strong> Users can dismiss the banner, which
              triggers the optional onDismiss callback
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 mr-2">•</span>
            <span>
              <strong>Accessibility:</strong> Includes ARIA attributes (role="alert",
              aria-live="polite") for screen readers
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 mr-2">•</span>
            <span>
              <strong>Responsive:</strong> Long titles are truncated to prevent
              layout issues
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 mr-2">•</span>
            <span>
              <strong>Null Rendering:</strong> Returns null when items array is
              empty, null, or undefined
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default AccountabilityBannerExample;
