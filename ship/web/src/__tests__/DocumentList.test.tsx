import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DocumentList from '../components/DocumentList';

// Mock data
const documents = [
  { id: 1, title: 'Document 1' },
  { id: 2, title: 'Document 2' },
];

// Mock navigate function
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('DocumentList Component', () => {
  test('Renders a list of documents', () => {
    render(
      <MemoryRouter>
        <DocumentList documents={documents} />
      </MemoryRouter>
    );
    documents.forEach(doc => {
      expect(screen.getByText(doc.title)).toBeInTheDocument();
    });
  });

  test('Shows empty state when no documents', () => {
    render(
      <MemoryRouter>
        <DocumentList documents={[]} />
      </MemoryRouter>
    );
    expect(screen.getByText('No documents available')).toBeInTheDocument();
  });

  test('Clicking a document navigates to detail page', () => {
    render(
      <MemoryRouter>
        <DocumentList documents={documents} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Document 1'));
    expect(mockNavigate).toHaveBeenCalledWith('/documents/1');
  });

  test('Supports selecting multiple documents', () => {
    render(
      <MemoryRouter>
        <DocumentList documents={documents} />
      </MemoryRouter>
    );
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(documents.length);
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();
  });

  test('Renders BulkActionBar when items are selected', () => {
    render(
      <MemoryRouter>
        <DocumentList documents={documents} />
      </MemoryRouter>
    );
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
  });
});
