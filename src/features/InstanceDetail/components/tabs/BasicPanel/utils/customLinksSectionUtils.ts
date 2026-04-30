import { BUTTON_TYPES } from '../../../../../../ui/icons/SocialIcons';
import type { CustomButton } from '../schemas/basicPanelSchemas';

export const createEmptyCustomButton = (): CustomButton => ({
  type: 'wiki',
  url: '',
  label: '',
});

export const addCustomButton = (buttons: CustomButton[]) => [
  ...buttons,
  createEmptyCustomButton(),
];

export const removeCustomButton = (buttons: CustomButton[], index: number) =>
  buttons.filter((_, buttonIndex) => buttonIndex !== index);

export const updateCustomButton = (
  buttons: CustomButton[],
  index: number,
  field: keyof CustomButton,
  value: string,
) =>
  buttons.map((button, buttonIndex) =>
    buttonIndex === index ? { ...button, [field]: value } : button,
  );

export const getCustomButtonDropdownOptions = () =>
  BUTTON_TYPES.map((type) => ({ label: type.label, value: type.value }));
