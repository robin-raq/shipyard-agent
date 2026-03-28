import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import BulkActionBar from '../components/BulkActionBar';

// Mock functions
const onBulkDelete = jest.fn();
const onBulkStatusChange = jest.fn();
const onSelectAllToggle = jest.fn();

const renderComponent = (selectedIds = []) => {
  render(
    <BulkActionBar
      selectedIds={selectedIds}
      onBulkDelete={onBulkDelete}
      onBulkStatusChange={onBulkStatusChange}
      onSelectAllToggle={onSelectAllToggle}
    />
  );
};

describe('BulkActionBar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Renders nothing when no items are selected', () => {
    renderComponent();
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  test('Shows "{count} selected" when items are selected', () => {
    renderComponent(['1', '2', '3']);
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  test('Has "Delete Selected" button that calls onBulkDelete with selected IDs', () => {
    renderComponent(['1', '2']);
    fireEvent.click(screen.getByText('Delete Selected'));
    expect(onBulkDelete).toHaveBeenCalledWith(['1', '2']);
  });

  test('Has "Change Status" dropdown that calls onBulkStatusChange with selected IDs and new status', () => {
    renderComponent(['1']);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'new-status' } });
    expect(onBulkStatusChange).toHaveBeenCalledWith(['1'], 'new-status');
  });

  test('Has "Select All" / "Deselect All" toggle', () => {
    renderComponent(['1']);
    fireEvent.click(screen.getByText('Select All'));
    expect(onSelectAllToggle).toHaveBeenCalled();
  });

  test('"Delete Selected" shows a confirmation before executing', () => {
    renderComponent(['1']);
    window.confirm = jest.fn(() => true); // Mock confirm to always return true
    fireEvent.click(screen.getByText('Delete Selected'));
    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete the selected items?');
    expect(onBulkDelete).toHaveBeenCalledWith(['1']);
  });
});
