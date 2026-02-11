import { useState } from 'react';
import { useEffect } from 'react';
import { useRef } from 'react';
import { useCallback } from 'react';
import { useMemo } from 'react';

interface ListsViewProps {
  lists: any[];
  users: any[];
  onAddItem: (listId: string, item: string) => void;
  onDeleteItem: (listId: string, item: string) => void;
}

const ListsView = ({ lists, users, onAddItem, onDeleteItem }: ListsViewProps) => {
  const [selectedList, setSelectedList] = useState(lists[0]);
  const listRef = useRef();

  const handleSelectList = (listId: string) => {
    setSelectedList(listId);
  };

  const handleAddItem = (item: string) => {
    onAddItem(selectedList, item);
  };

  const handleDeleteItem = (item: string) => {
    onDeleteItem(selectedList, item);
  };

  return (
    <div className="container">
      <h1>ListsView</h1>
      <ul>
        {lists.map((list) => (
          <li key={list.id} onClick={() => handleSelectList(list.id)}>
            {list.name}
          </li>
        ))}
      </ul>
      <div className="flex flex-col">
        <h2>{selectedList.name}</h2>
        <ul>
          {selectedList.items.map((item) => (
            <li key={item.id}>
              <input type="checkbox" checked={item.completed} onChange={() => handleCompleteItem(item.id)} />
              {item.name}
              <button className="btn-delete" onClick={() => handleDeleteItem(item.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-col">
          <input type="text" value={addItem} onChange={(e) => setAddItem(e.target.value)} />
          <button onClick={() => handleAddItem(addItem)}>Add Item</button>
        </div>
      </div>
    </div>
  );
};

export default ListsView;

