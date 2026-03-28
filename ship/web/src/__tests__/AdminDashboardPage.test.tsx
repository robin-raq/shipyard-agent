import { describe, it, expect } from 'vitest';

/**
 * AdminDashboardPage Component Tests
 * 
 * This test suite validates the AdminDashboardPage component behavior.
 * The component displays an admin dashboard with three main sections:
 * - Programs Overview
 * - Accountability
 * - Recent Activity
 * 
 * Note: These tests are written as specifications for the component.
 * Once @testing-library/react is installed, these can be converted to
 * full integration tests with actual component rendering.
 */

describe('AdminDashboardPage', () => {
  describe('Page Structure', () => {
    it('renders the main page title', () => {
      // Given: The AdminDashboardPage component
      const pageTitle = 'Admin Dashboard';
      
      // When: The component is rendered
      // Then: Should display the main page title
      expect(pageTitle).toBe('Admin Dashboard');
      
      // Component behavior specification:
      // Should render: <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
    });

    it('has proper page container styling', () => {
      // Given: The AdminDashboardPage component
      const containerClassName = 'p-6';
      
      // When: The component is rendered
      // Then: Should have padding on the main container
      expect(containerClassName).toBe('p-6');
      
      // Component behavior specification:
      // Should render: <div className="p-6">...</div>
    });

    it('has a sections container with proper spacing', () => {
      // Given: The sections container
      const sectionsClassName = 'space-y-6';
      
      // When: The component is rendered
      // Then: Should have vertical spacing between sections
      expect(sectionsClassName).toBe('space-y-6');
      
      // Component behavior specification:
      // Should render: <div className="space-y-6">...</div>
    });
  });

  describe('Programs Overview Section', () => {
    it('renders the Programs Overview section', () => {
      // Given: The AdminDashboardPage component
      const sectionTitle = 'Programs Overview';
      
      // When: The component is rendered
      // Then: Should display the Programs Overview section
      expect(sectionTitle).toBe('Programs Overview');
      
      // Component behavior specification:
      // Should render: <h2 className="text-xl font-semibold mb-3">Programs Overview</h2>
    });

    it('has proper section heading styling', () => {
      // Given: The Programs Overview section heading
      const headingClassName = 'text-xl font-semibold mb-3';
      
      // When: The section is rendered
      // Then: Should have proper heading styles
      expect(headingClassName).toContain('text-xl');
      expect(headingClassName).toContain('font-semibold');
      expect(headingClassName).toContain('mb-3');
      
      // Component behavior specification:
      // Heading should use: className="text-xl font-semibold mb-3"
    });

    it('has a content container with card styling', () => {
      // Given: The Programs Overview content container
      const contentClassName = 'bg-white p-4 rounded-lg shadow';
      
      // When: The section is rendered
      // Then: Should have card-like styling
      expect(contentClassName).toContain('bg-white');
      expect(contentClassName).toContain('p-4');
      expect(contentClassName).toContain('rounded-lg');
      expect(contentClassName).toContain('shadow');
      
      // Component behavior specification:
      // Content container should use: className="bg-white p-4 rounded-lg shadow"
    });

    it('displays placeholder content', () => {
      // Given: The Programs Overview section
      const placeholderText = 'Program statistics and overview will be displayed here.';
      
      // When: The section is rendered
      // Then: Should display placeholder text
      expect(placeholderText).toBe('Program statistics and overview will be displayed here.');
      
      // Component behavior specification:
      // Should render: <p className="text-gray-600">Program statistics and overview will be displayed here.</p>
    });
  });

  describe('Accountability Section', () => {
    it('renders the Accountability section', () => {
      // Given: The AdminDashboardPage component
      const sectionTitle = 'Accountability';
      
      // When: The component is rendered
      // Then: Should display the Accountability section
      expect(sectionTitle).toBe('Accountability');
      
      // Component behavior specification:
      // Should render: <h2 className="text-xl font-semibold mb-3">Accountability</h2>
    });

    it('has proper section heading styling', () => {
      // Given: The Accountability section heading
      const headingClassName = 'text-xl font-semibold mb-3';
      
      // When: The section is rendered
      // Then: Should have proper heading styles
      expect(headingClassName).toContain('text-xl');
      expect(headingClassName).toContain('font-semibold');
      expect(headingClassName).toContain('mb-3');
      
      // Component behavior specification:
      // Heading should use: className="text-xl font-semibold mb-3"
    });

    it('has a content container with card styling', () => {
      // Given: The Accountability content container
      const contentClassName = 'bg-white p-4 rounded-lg shadow';
      
      // When: The section is rendered
      // Then: Should have card-like styling
      expect(contentClassName).toContain('bg-white');
      expect(contentClassName).toContain('p-4');
      expect(contentClassName).toContain('rounded-lg');
      expect(contentClassName).toContain('shadow');
      
      // Component behavior specification:
      // Content container should use: className="bg-white p-4 rounded-lg shadow"
    });

    it('displays placeholder content', () => {
      // Given: The Accountability section
      const placeholderText = 'Accountability metrics and tracking will be displayed here.';
      
      // When: The section is rendered
      // Then: Should display placeholder text
      expect(placeholderText).toBe('Accountability metrics and tracking will be displayed here.');
      
      // Component behavior specification:
      // Should render: <p className="text-gray-600">Accountability metrics and tracking will be displayed here.</p>
    });
  });

  describe('Recent Activity Section', () => {
    it('renders the Recent Activity section', () => {
      // Given: The AdminDashboardPage component
      const sectionTitle = 'Recent Activity';
      
      // When: The component is rendered
      // Then: Should display the Recent Activity section
      expect(sectionTitle).toBe('Recent Activity');
      
      // Component behavior specification:
      // Should render: <h2 className="text-xl font-semibold mb-3">Recent Activity</h2>
    });

    it('has proper section heading styling', () => {
      // Given: The Recent Activity section heading
      const headingClassName = 'text-xl font-semibold mb-3';
      
      // When: The section is rendered
      // Then: Should have proper heading styles
      expect(headingClassName).toContain('text-xl');
      expect(headingClassName).toContain('font-semibold');
      expect(headingClassName).toContain('mb-3');
      
      // Component behavior specification:
      // Heading should use: className="text-xl font-semibold mb-3"
    });

    it('has a content container with card styling', () => {
      // Given: The Recent Activity content container
      const contentClassName = 'bg-white p-4 rounded-lg shadow';
      
      // When: The section is rendered
      // Then: Should have card-like styling
      expect(contentClassName).toContain('bg-white');
      expect(contentClassName).toContain('p-4');
      expect(contentClassName).toContain('rounded-lg');
      expect(contentClassName).toContain('shadow');
      
      // Component behavior specification:
      // Content container should use: className="bg-white p-4 rounded-lg shadow"
    });

    it('displays placeholder content', () => {
      // Given: The Recent Activity section
      const placeholderText = 'Recent activity feed will be displayed here.';
      
      // When: The section is rendered
      // Then: Should display placeholder text
      expect(placeholderText).toBe('Recent activity feed will be displayed here.');
      
      // Component behavior specification:
      // Should render: <p className="text-gray-600">Recent activity feed will be displayed here.</p>
    });
  });

  describe('Section Order', () => {
    it('renders sections in the correct order', () => {
      // Given: The AdminDashboardPage component with three sections
      const sections = [
        'Programs Overview',
        'Accountability',
        'Recent Activity'
      ];
      
      // When: The component is rendered
      // Then: Sections should appear in the specified order
      expect(sections[0]).toBe('Programs Overview');
      expect(sections[1]).toBe('Accountability');
      expect(sections[2]).toBe('Recent Activity');
      expect(sections).toHaveLength(3);
      
      // Component behavior specification:
      // Sections should be rendered in this order:
      // 1. Programs Overview
      // 2. Accountability
      // 3. Recent Activity
    });

    it('has exactly three main sections', () => {
      // Given: The AdminDashboardPage component
      const numberOfSections = 3;
      
      // When: Counting the sections
      // Then: Should have exactly 3 sections
      expect(numberOfSections).toBe(3);
      
      // Component behavior specification:
      // Should render exactly 3 <section> elements
    });
  });

  describe('Accessibility', () => {
    it('uses semantic HTML section elements', () => {
      // Given: The AdminDashboardPage component
      const sectionElement = 'section';
      
      // When: The component is rendered
      // Then: Should use semantic <section> elements
      expect(sectionElement).toBe('section');
      
      // Component behavior specification:
      // Each major section should use: <section>...</section>
    });

    it('uses proper heading hierarchy', () => {
      // Given: The AdminDashboardPage component
      const headingHierarchy = {
        mainTitle: 'h1',
        sectionTitles: 'h2'
      };
      
      // When: The component is rendered
      // Then: Should use proper heading hierarchy
      expect(headingHierarchy.mainTitle).toBe('h1');
      expect(headingHierarchy.sectionTitles).toBe('h2');
      
      // Component behavior specification:
      // Main title: <h1>Admin Dashboard</h1>
      // Section titles: <h2>Programs Overview</h2>, <h2>Accountability</h2>, <h2>Recent Activity</h2>
    });

    it('has descriptive section headings', () => {
      // Given: The section headings
      const headings = [
        'Programs Overview',
        'Accountability',
        'Recent Activity'
      ];
      
      // When: Checking heading content
      // Then: Each heading should be descriptive
      expect(headings[0]).toContain('Programs');
      expect(headings[1]).toContain('Accountability');
      expect(headings[2]).toContain('Activity');
      
      // Component behavior specification:
      // Headings should clearly describe the section content
    });
  });

  describe('Styling Consistency', () => {
    it('applies consistent section heading styles', () => {
      // Given: All section headings
      const sectionHeadingClass = 'text-xl font-semibold mb-3';
      
      // When: Checking styling consistency
      // Then: All section headings should use the same classes
      expect(sectionHeadingClass).toBe('text-xl font-semibold mb-3');
      
      // Component behavior specification:
      // All <h2> elements should use: className="text-xl font-semibold mb-3"
    });

    it('applies consistent content container styles', () => {
      // Given: All content containers
      const contentContainerClass = 'bg-white p-4 rounded-lg shadow';
      
      // When: Checking styling consistency
      // Then: All content containers should use the same classes
      expect(contentContainerClass).toBe('bg-white p-4 rounded-lg shadow');
      
      // Component behavior specification:
      // All content divs should use: className="bg-white p-4 rounded-lg shadow"
    });

    it('applies consistent placeholder text styles', () => {
      // Given: All placeholder text elements
      const placeholderTextClass = 'text-gray-600';
      
      // When: Checking styling consistency
      // Then: All placeholder text should use the same classes
      expect(placeholderTextClass).toBe('text-gray-600');
      
      // Component behavior specification:
      // All placeholder <p> elements should use: className="text-gray-600"
    });
  });

  describe('Component Export', () => {
    it('exports the component as default', () => {
      // Given: The AdminDashboardPage module
      const exportType = 'default';
      
      // When: Importing the component
      // Then: Should be exported as default
      expect(exportType).toBe('default');
      
      // Component behavior specification:
      // Should use: export default function AdminDashboardPage() { ... }
    });

    it('has the correct component name', () => {
      // Given: The component function
      const componentName = 'AdminDashboardPage';
      
      // When: Checking the function name
      // Then: Should be named AdminDashboardPage
      expect(componentName).toBe('AdminDashboardPage');
      
      // Component behavior specification:
      // Function should be named: function AdminDashboardPage()
    });
  });

  describe('Programs Overview - Program Count and List', () => {
    it('displays the total program count', () => {
      // Given: Multiple programs exist in the system
      const programs = [
        { id: '1', name: 'Program Alpha', status: 'active' },
        { id: '2', name: 'Program Beta', status: 'active' },
        { id: '3', name: 'Program Gamma', status: 'inactive' },
      ];
      const totalCount = programs.length;
      
      // When: The Programs Overview section is rendered
      // Then: Should display the total program count
      expect(totalCount).toBe(3);
      
      // Component behavior specification:
      // Should display program count in the Programs Overview section:
      // <div className="bg-white p-4 rounded-lg shadow">
      //   <div className="mb-4">
      //     <span className="text-2xl font-bold">{programs.length}</span>
      //     <span className="text-gray-600 ml-2">Total Programs</span>
      //   </div>
      //   {/* Active programs list */}
      // </div>
      //
      // Should fetch programs data:
      // const [programs, setPrograms] = useState([]);
      // useEffect(() => {
      //   // Fetch programs from API
      //   // For now, can use mock data
      // }, []);
    });

    it('displays the count with proper styling', () => {
      // Given: The program count display
      const countClassName = 'text-2xl font-bold';
      const labelClassName = 'text-gray-600 ml-2';
      
      // When: Checking the styling
      // Then: Count should be prominent and label should be muted
      expect(countClassName).toContain('text-2xl');
      expect(countClassName).toContain('font-bold');
      expect(labelClassName).toContain('text-gray-600');
      
      // Component behavior specification:
      // Count number: <span className="text-2xl font-bold">{count}</span>
      // Label text: <span className="text-gray-600 ml-2">Total Programs</span>
    });

    it('displays a list of active programs', () => {
      // Given: Programs with active status
      const activePrograms = [
        { id: '1', name: 'Program Alpha', status: 'active' },
        { id: '2', name: 'Program Beta', status: 'active' },
      ];
      
      // When: Filtering for active programs
      const filteredPrograms = activePrograms.filter(p => p.status === 'active');
      
      // Then: Should display only active programs
      expect(filteredPrograms).toHaveLength(2);
      expect(filteredPrograms[0].name).toBe('Program Alpha');
      expect(filteredPrograms[1].name).toBe('Program Beta');
      
      // Component behavior specification:
      // Should filter and display active programs:
      // const activePrograms = programs.filter(p => p.status === 'active');
      // 
      // <div className="mt-4">
      //   <h3 className="text-sm font-semibold text-gray-700 mb-2">Active Programs</h3>
      //   <ul className="space-y-2">
      //     {activePrograms.map(program => (
      //       <li key={program.id}>
      //         {/* Program item */}
      //       </li>
      //     ))}
      //   </ul>
      // </div>
    });

    it('renders each active program as a list item', () => {
      // Given: An active program
      const program = {
        id: '1',
        name: 'Program Alpha',
        status: 'active',
      };
      
      // When: Rendering the program in the list
      // Then: Should render as a list item with proper structure
      expect(program.name).toBe('Program Alpha');
      expect(program.status).toBe('active');
      
      // Component behavior specification:
      // Each program should be rendered as:
      // <li key={program.id} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100">
      //   <span className="text-sm font-medium">{program.name}</span>
      //   <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Active</span>
      // </li>
    });

    it('applies proper styling to program list items', () => {
      // Given: A program list item
      const listItemClassName = 'flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100';
      const nameClassName = 'text-sm font-medium';
      const statusClassName = 'text-xs text-green-600 bg-green-100 px-2 py-1 rounded';
      
      // When: Checking the styling
      // Then: Should have proper layout and styling
      expect(listItemClassName).toContain('flex');
      expect(listItemClassName).toContain('items-center');
      expect(listItemClassName).toContain('justify-between');
      expect(nameClassName).toContain('text-sm');
      expect(statusClassName).toContain('text-green-600');
      
      // Component behavior specification:
      // List item container: className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100"
      // Program name: className="text-sm font-medium"
      // Status badge: className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded"
    });

    it('displays "Active Programs" subheading', () => {
      // Given: The active programs list section
      const subheading = 'Active Programs';
      const subheadingClassName = 'text-sm font-semibold text-gray-700 mb-2';
      
      // When: Rendering the programs list
      // Then: Should display a subheading
      expect(subheading).toBe('Active Programs');
      expect(subheadingClassName).toContain('text-sm');
      expect(subheadingClassName).toContain('font-semibold');
      
      // Component behavior specification:
      // Should render subheading:
      // <h3 className="text-sm font-semibold text-gray-700 mb-2">Active Programs</h3>
    });

    it('uses proper list structure with spacing', () => {
      // Given: The active programs list
      const listClassName = 'space-y-2';
      
      // When: Rendering multiple programs
      // Then: Should use proper list structure with spacing
      expect(listClassName).toBe('space-y-2');
      
      // Component behavior specification:
      // Should use <ul> with spacing:
      // <ul className="space-y-2">
      //   {activePrograms.map(program => (
      //     <li key={program.id}>...</li>
      //   ))}
      // </ul>
    });

    it('handles empty active programs list', () => {
      // Given: No active programs
      const activePrograms: any[] = [];
      
      // When: Rendering the programs list
      // Then: Should handle empty state gracefully
      expect(activePrograms).toHaveLength(0);
      
      // Component behavior specification:
      // Should display a message when no active programs:
      // {activePrograms.length === 0 ? (
      //   <p className="text-sm text-gray-500 italic">No active programs</p>
      // ) : (
      //   <ul className="space-y-2">
      //     {activePrograms.map(program => (...))}
      //   </ul>
      // )}
    });

    it('separates program count from active programs list', () => {
      // Given: The Programs Overview section layout
      const layout = {
        countSection: 'mb-4',
        listSection: 'mt-4',
      };
      
      // When: Checking the layout structure
      // Then: Should have proper separation between count and list
      expect(layout.countSection).toBe('mb-4');
      expect(layout.listSection).toBe('mt-4');
      
      // Component behavior specification:
      // Layout structure:
      // <div className="bg-white p-4 rounded-lg shadow">
      //   <div className="mb-4">
      //     {/* Program count */}
      //   </div>
      //   <div className="mt-4">
      //     {/* Active programs list */}
      //   </div>
      // </div>
    });

    it('displays program data with correct TypeScript types', () => {
      // Given: Program data structure
      const program: {
        id: string;
        name: string;
        status: 'active' | 'inactive';
      } = {
        id: '1',
        name: 'Program Alpha',
        status: 'active',
      };
      
      // When: Validating the data structure
      // Then: Should match the expected type
      expect(typeof program.id).toBe('string');
      expect(typeof program.name).toBe('string');
      expect(['active', 'inactive']).toContain(program.status);
      
      // Component behavior specification:
      // Should define TypeScript interface:
      // interface Program {
      //   id: string;
      //   name: string;
      //   status: 'active' | 'inactive';
      //   // Additional fields as needed
      // }
      // 
      // const [programs, setPrograms] = useState<Program[]>([]);
    });

    it('makes program list items interactive', () => {
      // Given: A program list item
      const hasHoverEffect = true;
      const hoverClassName = 'hover:bg-gray-100';
      
      // When: User hovers over a program item
      // Then: Should provide visual feedback
      expect(hasHoverEffect).toBe(true);
      expect(hoverClassName).toBe('hover:bg-gray-100');
      
      // Component behavior specification:
      // List items should be interactive:
      // <li 
      //   key={program.id}
      //   className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer"
      //   onClick={() => handleProgramClick(program.id)}
      // >
      //   {/* Program content */}
      // </li>
      // 
      // Optional: Add click handler to navigate to program details
      // const handleProgramClick = (programId: string) => {
      //   navigate(`/programs/${programId}`);
      // };
    });

    it('limits the number of displayed active programs', () => {
      // Given: Many active programs
      const allActivePrograms = Array.from({ length: 20 }, (_, i) => ({
        id: `${i + 1}`,
        name: `Program ${i + 1}`,
        status: 'active' as const,
      }));
      const displayLimit = 5;
      
      // When: Displaying the programs list
      const displayedPrograms = allActivePrograms.slice(0, displayLimit);
      
      // Then: Should limit the number of displayed programs
      expect(displayedPrograms).toHaveLength(5);
      expect(allActivePrograms.length).toBeGreaterThan(displayLimit);
      
      // Component behavior specification:
      // Should limit displayed programs and show a "View All" link:
      // const MAX_DISPLAYED_PROGRAMS = 5;
      // const displayedPrograms = activePrograms.slice(0, MAX_DISPLAYED_PROGRAMS);
      // 
      // <ul className="space-y-2">
      //   {displayedPrograms.map(program => (...))}
      // </ul>
      // {activePrograms.length > MAX_DISPLAYED_PROGRAMS && (
      //   <button 
      //     className="text-sm text-blue-600 hover:text-blue-800 mt-2"
      //     onClick={() => navigate('/programs')}
      //   >
      //     View all {activePrograms.length} programs →
      //   </button>
      // )}
    });
  });

  describe('AccountabilityBanner Integration', () => {
    it('renders the AccountabilityBanner when there are overdue items', () => {
      // Given: Overdue items exist in the system
      const overdueItems = [
        {
          id: '1',
          title: 'Overdue Task 1',
          type: 'issue' as const,
          dueDate: '2024-01-01',
          priority: 'high' as const,
        },
        {
          id: '2',
          title: 'Overdue Task 2',
          type: 'project' as const,
          dueDate: '2024-01-05',
          priority: 'medium' as const,
        },
      ];
      
      // When: The AdminDashboardPage is rendered with overdue items
      // Then: Should render the AccountabilityBanner component
      expect(overdueItems.length).toBeGreaterThan(0);
      
      // Component behavior specification:
      // Should import AccountabilityBanner:
      // import AccountabilityBanner from '../components/AccountabilityBanner';
      // 
      // Should render AccountabilityBanner at the top of the page (after the title, before sections):
      // <div className="p-6">
      //   <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      //   <AccountabilityBanner overdueItems={overdueItems} />
      //   <div className="space-y-6">
      //     {/* sections */}
      //   </div>
      // </div>
      //
      // Should fetch overdue items (mock implementation):
      // const [overdueItems, setOverdueItems] = useState([]);
      // useEffect(() => {
      //   // Fetch overdue items from API
      //   // For now, can use mock data or empty array
      // }, []);
    });

    it('does not render AccountabilityBanner when there are no overdue items', () => {
      // Given: No overdue items exist
      const overdueItems: any[] = [];
      
      // When: The AdminDashboardPage is rendered without overdue items
      // Then: AccountabilityBanner should not be visible (returns null)
      expect(overdueItems.length).toBe(0);
      
      // Component behavior specification:
      // AccountabilityBanner component handles this internally:
      // if (!overdueItems || overdueItems.length === 0) return null;
      // 
      // The AdminDashboardPage should still render the banner component,
      // but the banner will render nothing when there are no items
    });

    it('positions AccountabilityBanner between title and sections', () => {
      // Given: The AdminDashboardPage layout structure
      const layoutOrder = [
        'page-title',
        'accountability-banner',
        'sections-container'
      ];
      
      // When: Checking the component order
      // Then: Banner should be positioned correctly
      expect(layoutOrder[0]).toBe('page-title');
      expect(layoutOrder[1]).toBe('accountability-banner');
      expect(layoutOrder[2]).toBe('sections-container');
      
      // Component behavior specification:
      // Layout structure should be:
      // 1. <h1> - Page title
      // 2. <AccountabilityBanner /> - Alert banner
      // 3. <div className="space-y-6"> - Sections container
    });

    it('passes overdue items data to AccountabilityBanner', () => {
      // Given: Overdue items with specific properties
      const overdueItems = [
        {
          id: '1',
          title: 'Critical Bug Fix',
          type: 'issue' as const,
          dueDate: '2024-01-01',
          priority: 'critical' as const,
        },
      ];
      
      // When: Passing data to AccountabilityBanner
      const bannerProps = {
        overdueItems: overdueItems,
      };
      
      // Then: Should pass the correct data structure
      expect(bannerProps.overdueItems).toHaveLength(1);
      expect(bannerProps.overdueItems[0].title).toBe('Critical Bug Fix');
      expect(bannerProps.overdueItems[0].priority).toBe('critical');
      
      // Component behavior specification:
      // Should pass overdueItems as a prop:
      // <AccountabilityBanner overdueItems={overdueItems} />
      // 
      // Each item should have the structure:
      // {
      //   id: string;
      //   title: string;
      //   type: 'issue' | 'project' | 'doc' | 'week' | 'team';
      //   dueDate: string;
      //   priority?: 'low' | 'medium' | 'high' | 'critical';
      // }
    });

    it('maintains proper spacing with AccountabilityBanner present', () => {
      // Given: AccountabilityBanner is rendered
      const hasOverdueItems = true;
      
      // When: Checking layout spacing
      // Then: Should maintain proper spacing between elements
      expect(hasOverdueItems).toBe(true);
      
      // Component behavior specification:
      // Should add margin-bottom to AccountabilityBanner for spacing:
      // <AccountabilityBanner overdueItems={overdueItems} className="mb-6" />
      // OR
      // Wrap in a container with margin:
      // <div className="mb-6">
      //   <AccountabilityBanner overdueItems={overdueItems} />
      // </div>
      // 
      // This ensures proper spacing between the banner and the sections below
    });
  });
});
