// src/features/runtime/components/JVMParamsEditor.tsx
import React from 'react';
import { OreInput } from '../../../ui/primitives/OreInput';

interface JVMParamsEditorProps {
  value: string;
  onChange: (args: string) => void;
  disabled?: boolean;
  onArrowPress?: (direction: string) => boolean;
}

export const JVMParamsEditor: React.FC<JVMParamsEditorProps> = ({ value, onChange, disabled, onArrowPress }) => {
  return (
    <div className="w-full">
      <OreInput
        focusKey="java-input-jvm" // ✅ 补充焦点ID
        onArrowPress={onArrowPress}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="-Dexample.option=value"
        disabled={disabled}
      />
    </div>
  );
};
