import DocumentList from '../components/DocumentList';
import { getWeeks, createWeek, deleteWeek } from '../api/client';

export default function WeeksPage() {
  return (
    <DocumentList 
      entityType="weeks" 
      heading="Weeks"
      fetchItems={getWeeks}
      createItem={createWeek}
      deleteItem={deleteWeek}
    />
  );
}
