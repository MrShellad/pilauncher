export type ShowcaseCategory = 'buttons' | 'progress' | 'inputs' | 'selectors' | 'feedback';

export const SHOWCASE_CATEGORIES: Array<{ id: ShowcaseCategory; label: string }> = [
  { id: 'buttons', label: '按钮体系 (Buttons)' },
  { id: 'progress', label: '进度条 (Progress)' },
  { id: 'inputs', label: '表单与输入 (Inputs)' },
  { id: 'selectors', label: '选择器 (Selectors)' },
  { id: 'feedback', label: '反馈与卡片 (Feedback)' },
];
