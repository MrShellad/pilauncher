export const getEditableInstanceName = (name?: string) => name || '';

export const canSaveInstanceName = (editName: string, initialName: string) =>
  editName !== initialName && editName.trim() !== '';
