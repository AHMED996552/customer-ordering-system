import React, { useState } from 'react';

interface QuantitySelectorProps {
  value: number;
  onChange: (val: number) => void;
}

const QuantitySelector: React.FC<QuantitySelectorProps> = ({ value, onChange }) => {
  const [touched, setTouched] = useState(false);
  const isInvalid = touched && value < 1;

  return (
    <div>
      <input
        type="number"
        role="spinbutton"
        value={value}
        min={1}
        onChange={e => {
          setTouched(true);
          onChange(Number(e.target.value));
        }}
        onBlur={() => setTouched(true)}
        aria-label="Quantity"
        style={{ width: 64 }}
      />
      {isInvalid && (
        <span style={{ color: 'red', fontSize: '0.8rem', display: 'block' }}>
          Quantity must be at least 1
        </span>
      )}
    </div>
  );
};

export default QuantitySelector;
