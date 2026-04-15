import React from 'react';
import type { TFunction } from 'i18next';
import { Pin } from 'lucide-react';
import { OreAssetRow } from '../../../../../ui/primitives/OreAssetRow';
import { OreTag } from '../../../../../ui/primitives/OreTag';
import type { InstanceSnapshot } from '../../../../logic/modService';
import { getVersionLabel } from './modSnapshotUtils';
import { getTimelineFocusKey } from './useModSnapshot';

const insetStyle: React.CSSProperties = {
  backgroundColor: 'var(--ore-downloadDetail-base)',
  borderColor: 'var(--ore-downloadDetail-divider)',
  boxShadow: 'var(--ore-downloadDetail-sectionInset)'
};

export interface SnapshotTimelineListProps {
  history: InstanceSnapshot[];
  selectedSnapshotId: string | null;
  t: TFunction;
  formatDate: (ts: number) => string;
  onSelect: (id: string) => void;
  onArrowPress: (id: string) => (direction: string) => boolean | undefined;
}

export const SnapshotTimelineList: React.FC<SnapshotTimelineListProps> = ({
  history,
  selectedSnapshotId,
  t,
  formatDate,
  onSelect,
  onArrowPress
}) => {
  if (history.length === 0) {
    return (
      <div
        className="flex min-h-48 items-center justify-center border-[0.125rem] px-6 py-10 text-center text-sm text-[var(--ore-downloadDetail-mutedText)]"
        style={insetStyle}
      >
        {t('modSnapshots.empty', { defaultValue: 'No snapshot records yet.' })}
      </div>
    );
  }

  return (
    <div className="custom-scrollbar flex flex-col gap-2 overflow-y-auto px-1 pt-1 pr-2 pb-2">
      {history.map((snapshot, index) => {
        const isSelected = selectedSnapshotId === snapshot.id;
        const versionLabel = getVersionLabel(t, index, history.length);

        return (
          <OreAssetRow
            key={snapshot.id}
            focusKey={getTimelineFocusKey(snapshot.id)}
            onClick={() => onSelect(snapshot.id)}
            onFocus={() => onSelect(snapshot.id)}
            onEnter={() => onSelect(snapshot.id)}
            onArrowPress={onArrowPress(snapshot.id)}
            selected={isSelected}
            operationActive={isSelected}
            title={versionLabel}
            description={snapshot.message || t('modSnapshots.labels.noMessage', { defaultValue: 'No note provided' })}
            badges={
              index === 0 ? (
                <OreTag variant="primary" size="sm" weight="bold">
                  <Pin size={12} className="mr-1 inline-block" />
                  {t('modSnapshots.tags.latest', { defaultValue: 'Latest' })}
                </OreTag>
              ) : undefined
            }
            metaItems={[
              formatDate(snapshot.timestamp),
              t('modSnapshots.timeline.modCount', {
                defaultValue: '{{count}} mods',
                count: snapshot.mods.length
              })
            ]}
          />
        );
      })}
    </div>
  );
};
