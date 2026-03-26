import ShipList from '../components/ShipList';
import { getShips, createShip, deleteShip } from '../api/client';

export default function ShipsPage() {
  return (
    <ShipList 
      entityType="ships" 
      heading="Ships"
      fetchItems={getShips}
      createItem={createShip}
      deleteItem={deleteShip}
    />
  );
}
