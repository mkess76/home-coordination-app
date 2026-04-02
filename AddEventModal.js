// AddEventModal.js
import React, { useState } from 'react';
import AddEventButton from './AddEventButton';
import AddEventForm from './AddEventForm';

const AddEventModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  return (
    <div>
      <AddEventButton onClick={handleOpen} />
      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '300px' }}>
            <AddEventForm onSubmit={(data) => {
              // Handle form submission here
              console.log('Form submitted:', data);
              handleClose();
            }} />
            <button onClick={handleClose} style={{ marginTop: '10px', display: 'block' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddEventModal;