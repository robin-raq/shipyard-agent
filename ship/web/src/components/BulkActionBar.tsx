import React from 'react';

interface BulkActionBarProps {
  selectedIds: string[];
  onBulkDelete: (ids: string[]) => void;
  onBulkStatusChange: (ids: string[], status: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  totalCount: number;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedIds,
  onBulkDelete,
  onBulkStatusChange,
  onSelectAll,
  onDeselectAll,
  totalCount,
}) => {
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete the selected items?')) {
      onBulkDelete(selectedIds);
    }
  };

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onBulkStatusChange(selectedIds, event.target.value);
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-white shadow-md p-4 ${selectedIds.length === 0 ? 'hidden' : 'flex'} justify-between items-center`}>
      <div>
        <span>{selectedIds.length} selected</span>
        <button onClick={selectedIds.length === totalCount ? onDeselectAll : onSelectAll} className="ml-4 text-blue-500">
          {selectedIds.length === totalCount ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      <div className="flex items-center">
        <select onChange={handleStatusChange} className="mr-4 p-2 border rounded">
          <option value="">Change Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="archived">Archived</option>
        </select>
        <button onClick={handleDelete} className="bg-red-500 text-white p-2 rounded">Delete Selected</button>
      </div>
    </div>
  );
};

export default BulkActionBar;
