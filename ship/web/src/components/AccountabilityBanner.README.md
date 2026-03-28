# AccountabilityBanner Component

A React component that displays a warning banner for overdue accountability items with priority-based sorting, dismissible interface, and full accessibility support.

## 📁 Files

- **Component**: `ship/web/src/components/AccountabilityBanner.tsx`
- **Tests**: `ship/web/src/__tests__/AccountabilityBanner.test.tsx`
- **Examples**: `ship/web/src/components/AccountabilityBanner.example.tsx`

## ✅ Test Results

**All 30 tests passing** ✓

```
✓ src/__tests__/AccountabilityBanner.test.tsx (30 tests) 14ms
```

## 🎯 Features

### Core Functionality
- ✅ **Conditional Rendering**: Returns `null` when there are no overdue items
- ✅ **Priority Sorting**: Automatically sorts items by priority (critical → high → medium → low)
- ✅ **Limited Display**: Shows up to 3 items by default with "and X more..." indicator
- ✅ **Dismissible**: Users can dismiss the banner with state management
- ✅ **Responsive Design**: Text truncation for long titles

### Accessibility
- ✅ **ARIA Attributes**: `role="alert"` and `aria-live="polite"`
- ✅ **Semantic HTML**: Proper use of `<ul>`, `<li>`, `<button>` elements
- ✅ **Keyboard Navigation**: Focus management with visible focus rings
- ✅ **Screen Reader Support**: Descriptive ARIA labels

### Styling
- ✅ **TailwindCSS**: Utility-first approach consistent with codebase
- ✅ **Warning Color Scheme**: Red color palette (`bg-red-50`, `border-red-200`, `text-red-700`)
- ✅ **Priority Badges**: Color-coded badges for priority levels
- ✅ **Type Badges**: Color-coded badges for item types
- ✅ **Hover States**: Interactive feedback on buttons
- ✅ **Focus Rings**: Visible focus indicators for accessibility

## 📋 Props Interface

```typescript
interface AccountabilityItem {
  id: string;                    // Unique identifier
  title: string;                 // Item title (required)
  assignee_id?: string;          // Assignee ID (optional)
  status: string;                // Status (required)
  due_date: string;              // Due date in ISO format (required)
  type?: 'issue' | 'project' | 'doc' | 'week' | 'team';  // Item type (optional)
  priority?: 'low' | 'medium' | 'high' | 'critical';     // Priority level (optional)
}

interface AccountabilityBannerProps {
  items?: AccountabilityItem[];  // Array of overdue items (optional)
  onDismiss?: () => void;        // Callback when banner is dismissed (optional)
  maxDisplay?: number;           // Max items to display (default: 3)
}
```

## 🚀 Usage

### Basic Usage

```tsx
import AccountabilityBanner from './components/AccountabilityBanner';

function MyPage() {
  const overdueItems = [
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
      title: 'Fix Critical Bug',
      assignee_id: 'user-456',
      status: 'overdue',
      due_date: '2024-01-10',
      type: 'issue',
      priority: 'critical',
    },
  ];

  return (
    <div>
      <AccountabilityBanner items={overdueItems} />
      {/* Rest of your page */}
    </div>
  );
}
```

### With Dismiss Callback

```tsx
<AccountabilityBanner
  items={overdueItems}
  onDismiss={() => {
    console.log('Banner dismissed');
    // Save to localStorage, send analytics, etc.
  }}
/>
```

### Custom Max Display

```tsx
<AccountabilityBanner
  items={overdueItems}
  maxDisplay={5}  // Show up to 5 items instead of default 3
/>
```

### Handling Empty State

```tsx
// Component automatically returns null when items is empty, null, or undefined
<AccountabilityBanner items={[]} />  // Renders nothing
<AccountabilityBanner items={null} />  // Renders nothing
<AccountabilityBanner items={undefined} />  // Renders nothing
```

## 🎨 Visual Design

### Banner Structure

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️  You have 2 overdue items                            ✕   │
│                                                             │
│ • Complete Q1 Performance Review  [doc] [high]              │
│   Due: 1/15/2024                                            │
│                                                             │
│ • Fix Critical Bug  [issue] [critical]                      │
│   Due: 1/10/2024                                            │
│                                                             │
│ and 1 more...                                               │
└─────────────────────────────────────────────────────────────┘
```

### Color Scheme

**Banner Background**: Red warning theme
- Background: `bg-red-50`
- Border: `border-red-200`
- Text: `text-red-700` / `text-red-900`

**Priority Badges**:
- Critical: Red (`bg-red-100 text-red-800`)
- High: Orange (`bg-orange-100 text-orange-800`)
- Medium: Yellow (`bg-yellow-100 text-yellow-800`)
- Low: Blue (`bg-blue-100 text-blue-800`)

**Type Badges**:
- Issue: Purple (`bg-purple-100 text-purple-800`)
- Project: Green (`bg-green-100 text-green-800`)
- Doc: Indigo (`bg-indigo-100 text-indigo-800`)
- Week: Pink (`bg-pink-100 text-pink-800`)
- Team: Teal (`bg-teal-100 text-teal-800`)

## 🧪 Test Coverage

### Rendering Behavior (7 tests)
- ✅ Renders nothing when there are no overdue items
- ✅ Renders nothing when overdueItems is undefined
- ✅ Renders nothing when overdueItems is null
- ✅ Renders banner when overdue items exist
- ✅ Displays correct count of overdue items
- ✅ Displays singular text for one overdue item
- ✅ Displays plural text for multiple overdue items

### Styling and Accessibility (3 tests)
- ✅ Applies warning styles to the banner
- ✅ Has proper ARIA role for alert
- ✅ Has proper ARIA live region

### Content Display (4 tests)
- ✅ Renders each overdue item's title
- ✅ Displays overdue item titles
- ✅ Displays item types
- ✅ Displays priority levels
- ✅ Formats due dates correctly

### Priority Sorting (1 test)
- ✅ Sorts items by priority (critical > high > medium > low)

### Limit Display (2 tests)
- ✅ Shows only first 3 items by default
- ✅ Displays "and X more" text when there are more items

### Edge Cases (4 tests)
- ✅ Handles empty array gracefully
- ✅ Handles null overdueItems prop
- ✅ Handles items with missing optional fields
- ✅ Handles very long item titles

### Component Props Interface (3 tests)
- ✅ Accepts overdueItems as an array
- ✅ Accepts optional onDismiss callback
- ✅ Accepts optional maxDisplay prop

### Dismiss Functionality (5 tests)
- ✅ Has a dismiss button that hides the banner
- ✅ Calls onDismiss callback when dismiss button is clicked
- ✅ Manages internal dismissed state
- ✅ Does not render banner after dismissal
- ✅ Dismiss button has proper accessibility attributes

## 🔧 Implementation Details

### State Management
```typescript
const [isDismissed, setIsDismissed] = useState(false);
```

### Priority Sorting Algorithm
```typescript
const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
const sortedItems = [...items].sort((a, b) => {
  const aPriority = a.priority ? priorityOrder[a.priority] : 999;
  const bPriority = b.priority ? priorityOrder[b.priority] : 999;
  return aPriority - bPriority;
});
```

### Date Formatting
```typescript
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  } catch {
    return dateString;
  }
};
```

## 📦 Dependencies

- **React**: ^19.0.0
- **TypeScript**: ^5.7.0
- **TailwindCSS**: ^4.0.0

## 🎯 Design Patterns

1. **Conditional Rendering**: Returns `null` for empty states
2. **TypeScript Interfaces**: Strong typing for props and data
3. **Functional Components**: React hooks (`useState`)
4. **Accessibility-First**: ARIA attributes and semantic HTML
5. **Utility-First CSS**: TailwindCSS classes
6. **Immutable Sorting**: Uses spread operator to avoid mutating props
7. **Optional Chaining**: Safe access to optional properties
8. **Callback Pattern**: Optional `onDismiss` prop for parent integration

## 🚨 Important Notes

1. **Null Rendering**: The component returns `null` when there are no items. This is intentional and tested.
2. **Priority Sorting**: Items are always sorted by priority before display, regardless of input order.
3. **Max Display**: Default is 3 items. Use `maxDisplay` prop to customize.
4. **Dismiss State**: Dismissal is managed internally with `useState`. Once dismissed, the banner won't re-appear until the component is remounted.
5. **Date Format**: Uses browser's `toLocaleDateString()` for locale-aware formatting.

## 📚 Related Components

This component follows the same patterns as:
- `ship/web/src/pages/IssuesPage.tsx`
- `ship/web/src/pages/DocumentsPage.tsx`

## 🔗 Integration Example

```tsx
// In your main layout or dashboard
import { useEffect, useState } from 'react';
import AccountabilityBanner from './components/AccountabilityBanner';

function Dashboard() {
  const [overdueItems, setOverdueItems] = useState([]);

  useEffect(() => {
    // Fetch overdue items from API
    fetch('/api/accountability/overdue')
      .then(res => res.json())
      .then(data => setOverdueItems(data));
  }, []);

  return (
    <div>
      <AccountabilityBanner
        items={overdueItems}
        onDismiss={() => {
          // Track dismissal in analytics
          analytics.track('accountability_banner_dismissed');
        }}
      />
      {/* Rest of dashboard */}
    </div>
  );
}
```

## ✨ Summary

The **AccountabilityBanner** component is a production-ready, fully tested React component that:
- ✅ Passes all 30 comprehensive tests
- ✅ Follows codebase patterns and conventions
- ✅ Provides excellent accessibility support
- ✅ Handles all edge cases gracefully
- ✅ Offers flexible customization options
- ✅ Includes complete TypeScript typing
- ✅ Uses TailwindCSS for consistent styling

Ready to use in production! 🚀
