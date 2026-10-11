export const filterBarScaleClassName = `
  [--filter-shell-px:0.875rem]
  [--filter-shell-py:0.5rem]
  [--filter-section-gap:0.5rem]
  [--filter-row-gap:0.375rem]
  [--filter-col-gap:0.375rem]
  [--filter-control-h:2.5rem]
  [--filter-tab-min-w:7.25rem]
  [--filter-tab-max-w:48rem]
  [--filter-tab-font:0.6875rem]
  [--filter-tab-icon:0.9375rem]
  [--filter-tab-gap:0.5rem]
  [--filter-tab-px:0.75rem]
  [--filter-tab-indicator-h:0.125rem]
  [--filter-tab-indicator-bottom:0.25rem]
  [--filter-tab-indicator-inset:0.625rem]
  [--filter-action-font:0.8125rem]
  [--filter-input-font:0.75rem]
  [--filter-icon-size:0.875rem]
  [--filter-control-hint-scale:1]
  min-[1920px]:[--filter-shell-px:1rem]
  min-[1920px]:[--filter-shell-py:0.625rem]
  min-[1920px]:[--filter-section-gap:0.625rem]
  min-[1920px]:[--filter-row-gap:0.5rem]
  min-[1920px]:[--filter-col-gap:0.5rem]
  min-[1920px]:[--filter-control-h:2.75rem]
  min-[1920px]:[--filter-tab-min-w:8.25rem]
  min-[1920px]:[--filter-tab-max-w:56rem]
  min-[1920px]:[--filter-tab-font:0.75rem]
  min-[1920px]:[--filter-tab-icon:1rem]
  min-[1920px]:[--filter-tab-gap:0.625rem]
  min-[1920px]:[--filter-tab-px:0.875rem]
  min-[1920px]:[--filter-tab-indicator-h:0.1875rem]
  min-[1920px]:[--filter-tab-indicator-bottom:0.3125rem]
  min-[1920px]:[--filter-tab-indicator-inset:0.75rem]
  min-[1920px]:[--filter-action-font:0.875rem]
  min-[1920px]:[--filter-input-font:0.8125rem]
  min-[1920px]:[--filter-icon-size:0.9375rem]
  min-[1920px]:[--filter-control-hint-scale:1.08]
  min-[2560px]:[--filter-shell-px:1.25rem]
  min-[2560px]:[--filter-shell-py:0.75rem]
  min-[2560px]:[--filter-section-gap:0.75rem]
  min-[2560px]:[--filter-row-gap:0.625rem]
  min-[2560px]:[--filter-col-gap:0.625rem]
  min-[2560px]:[--filter-control-h:3rem]
  min-[2560px]:[--filter-tab-min-w:9.25rem]
  min-[2560px]:[--filter-tab-max-w:66rem]
  min-[2560px]:[--filter-tab-font:0.875rem]
  min-[2560px]:[--filter-tab-icon:1.125rem]
  min-[2560px]:[--filter-tab-gap:0.75rem]
  min-[2560px]:[--filter-tab-px:1rem]
  min-[2560px]:[--filter-tab-indicator-h:0.1875rem]
  min-[2560px]:[--filter-tab-indicator-bottom:0.375rem]
  min-[2560px]:[--filter-tab-indicator-inset:0.875rem]
  min-[2560px]:[--filter-action-font:0.9375rem]
  min-[2560px]:[--filter-input-font:0.875rem]
  min-[2560px]:[--filter-icon-size:1rem]
  min-[2560px]:[--filter-control-hint-scale:1.16]
  min-[3840px]:[--filter-shell-px:1.5rem]
  min-[3840px]:[--filter-shell-py:0.875rem]
  min-[3840px]:[--filter-section-gap:0.875rem]
  min-[3840px]:[--filter-row-gap:0.75rem]
  min-[3840px]:[--filter-col-gap:0.75rem]
  min-[3840px]:[--filter-control-h:3.5rem]
  min-[3840px]:[--filter-tab-min-w:10.75rem]
  min-[3840px]:[--filter-tab-max-w:78rem]
  min-[3840px]:[--filter-tab-font:1rem]
  min-[3840px]:[--filter-tab-icon:1.25rem]
  min-[3840px]:[--filter-tab-gap:0.875rem]
  min-[3840px]:[--filter-tab-px:1.25rem]
  min-[3840px]:[--filter-tab-indicator-h:0.25rem]
  min-[3840px]:[--filter-tab-indicator-bottom:0.4375rem]
  min-[3840px]:[--filter-tab-indicator-inset:1rem]
  min-[3840px]:[--filter-action-font:1.0625rem]
  min-[3840px]:[--filter-input-font:1rem]
  min-[3840px]:[--filter-icon-size:1.125rem]
  min-[3840px]:[--filter-control-hint-scale:1.28]
`;

export const filterFieldClassName = 'min-w-0 min-h-[var(--filter-control-h)]';
export const filterControlHintClassName = 'origin-center scale-[var(--filter-control-hint-scale)]';
export const filterSourceToggleClassName = `
  !m-0
  [&_.ore-toggle-btn-group]:!h-[var(--filter-control-h)]
  [&_.ore-toggle-btn-item]:!h-[var(--filter-control-h)]
  [&_.ore-toggle-btn-item]:!px-[0.75rem]
  [&_.ore-toggle-btn-item]:!text-[var(--filter-input-font)]
  [&_.ore-toggle-btn-item_svg]:size-[var(--filter-icon-size)]
`;
export const filterInputContainerClassName =
  'w-full !space-y-0 [&_svg]:size-[var(--filter-icon-size)]';
export const filterInputClassName =
  '!border-[#0F1011] !bg-[#171819] !text-[var(--filter-input-font)] !text-white placeholder:!text-[#B8C0C7]';
export const filterDropdownClassName =
  'w-full !h-[var(--filter-control-h)] [&_.ore-dropdown-trigger]:!h-[var(--filter-control-h)] [&_.ore-dropdown-trigger]:!border-[#141516] [&_.ore-dropdown-trigger]:!bg-[#E4E7EB] [&_.ore-dropdown-trigger>div>span]:!text-[#121314] [&_.ore-dropdown-trigger>div>span]:!text-[var(--filter-input-font)] [&_.ore-dropdown-trigger_svg]:!text-[#121314] [&_.ore-dropdown-trigger_svg]:size-[var(--filter-icon-size)]';
export const filterActionButtonClassName =
  'w-full !h-[var(--filter-control-h)] !text-[var(--filter-action-font)] font-bold tracking-wider [&_svg]:size-[var(--filter-icon-size)]';

export const getFilterTabButtonClassName = (isCompactOrDeck: boolean) => `
  relative flex h-[var(--filter-control-h)] ${isCompactOrDeck ? 'min-w-0' : 'min-w-[var(--filter-tab-min-w)]'} flex-1 items-center justify-center
  gap-[var(--filter-tab-gap)] border-[0.125rem] border-[#141516] px-[var(--filter-tab-px)] pb-[0.1875rem]
  font-minecraft text-[var(--filter-tab-font)] uppercase tracking-[0.14em] outline-none transition-none
`;
