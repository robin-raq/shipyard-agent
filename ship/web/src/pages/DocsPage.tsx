import DocumentList from '../components/DocumentList';
import { getDocs, createDoc, deleteDoc } from '../api/client';

export default function DocsPage() {
  return (
    <DocumentList 
      entityType="docs" 
      heading="Documents"
      fetchItems={getDocs}
      createItem={createDoc}
      deleteItem={deleteDoc}
    />
  );
}
