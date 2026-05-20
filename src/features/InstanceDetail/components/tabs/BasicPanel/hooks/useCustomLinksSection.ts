import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  addCustomButton,
  getCustomButtonDropdownOptions,
  removeCustomButton,
  updateCustomButton,
} from '../utils/customLinksSectionUtils';
import type { CustomButton } from '../schemas/basicPanelSchemas';

interface UseCustomLinksSectionOptions {
  initialButtons?: CustomButton[];
  onUpdateCustomButtons: (buttons: CustomButton[]) => Promise<void>;
  onSuccess: (msg: string) => void;
  setIsGlobalSaving: (val: boolean) => void;
}

export const useCustomLinksSection = ({
  initialButtons = [],
  onUpdateCustomButtons,
  onSuccess,
  setIsGlobalSaving,
}: UseCustomLinksSectionOptions) => {
  const [customButtons, setCustomButtons] = useState<CustomButton[]>(initialButtons);

  useEffect(() => {
    setCustomButtons(initialButtons);
  }, [initialButtons]);

  const handleSaveCustomButtons = useCallback(async () => {
    setIsGlobalSaving(true);
    await onUpdateCustomButtons(customButtons);
    setIsGlobalSaving(false);
    onSuccess('自定义链接已保存');
  }, [customButtons, onSuccess, onUpdateCustomButtons, setIsGlobalSaving]);

  const handleAddButton = useCallback(() => {
    setCustomButtons((buttons) => addCustomButton(buttons));
  }, []);

  const handleRemoveButton = useCallback((index: number) => {
    setCustomButtons((buttons) => removeCustomButton(buttons, index));
  }, []);

  const handleChangeButton = useCallback((
    index: number,
    field: keyof CustomButton,
    value: string,
  ) => {
    setCustomButtons((buttons) => updateCustomButton(buttons, index, field, value));
  }, []);

  const dropdownOptions = useMemo(() => getCustomButtonDropdownOptions(), []);

  return {
    customButtons,
    dropdownOptions,
    handleSaveCustomButtons,
    handleAddButton,
    handleRemoveButton,
    handleChangeButton,
  };
};
