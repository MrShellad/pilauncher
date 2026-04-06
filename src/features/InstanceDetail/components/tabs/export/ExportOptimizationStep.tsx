import React from 'react';
import { FileArchive, Package, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CurseforgeIcon, ModrinthIcon } from '../../../../Download/components/Icons';
import { OreSwitch } from '../../../../../ui/primitives/OreSwitch';
import type { ExportData } from './ExportPanel';

interface ExportOptimizationStepProps {
  data: ExportData;
  onChange: (data: Partial<ExportData>) => void;
}

export const ExportOptimizationStep: React.FC<ExportOptimizationStepProps> = ({
  data,
  onChange,
}) => {
  const { t } = useTranslation();

  const formats: {
    id: ExportData['format'];
    label: string;
    desc: string;
    icon: React.FC<any>;
    color: string;
  }[] = [
    {
      id: 'pipack',
      label: t('instanceExport.optimization.formats.pipack.label', { defaultValue: 'PiPack' }),
      desc: t('instanceExport.optimization.formats.pipack.desc', {
        defaultValue: 'PiLauncher smart pack with mixed-source mod recovery.',
      }),
      icon: Package,
      color: 'text-[#FFE866]',
    },
    {
      id: 'zip',
      label: t('instanceExport.optimization.formats.zip.label', { defaultValue: 'Standard ZIP' }),
      desc: t('instanceExport.optimization.formats.zip.desc', {
        defaultValue: 'Maximum compatibility and full file bundling.',
      }),
      icon: FileArchive,
      color: 'text-[#D0D1D4]',
    },
    {
      id: 'curseforge',
      label: t('instanceExport.optimization.formats.curseforge.label', {
        defaultValue: 'CurseForge',
      }),
      desc: t('instanceExport.optimization.formats.curseforge.desc', {
        defaultValue: 'Exports a CurseForge-style archive with manifest.json.',
      }),
      icon: CurseforgeIcon,
      color: 'text-[#F16436]',
    },
    {
      id: 'mrpack',
      label: t('instanceExport.optimization.formats.mrpack.label', {
        defaultValue: 'Modrinth (mrpack)',
      }),
      desc: t('instanceExport.optimization.formats.mrpack.desc', {
        defaultValue: 'Exports a Modrinth-compatible mrpack archive.',
      }),
      icon: ModrinthIcon,
      color: 'text-[#1BD96A]',
    },
  ];

  const manifestLocked = data.format === 'pipack';
  const manifestChecked = manifestLocked ? true : data.manifestMode;

  return (
    <div className="flex flex-col space-y-4 sm:space-y-5 2xl:space-y-6">
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4 xl:gap-5 2xl:gap-6">
        {formats.map((formatItem) => (
          <button
            key={formatItem.id}
            type="button"
            onClick={() => onChange({ format: formatItem.id })}
            className={`flex h-[6.25rem] w-full select-none flex-col items-center justify-center gap-2 rounded-sm border-2 px-3 py-3 text-center transition-[background-color,box-shadow] sm:h-[6.75rem] sm:gap-2.5 sm:px-4 sm:py-[0.875rem] xl:h-[7.125rem] xl:px-[1.25rem] xl:py-[1rem] 2xl:h-[7.5rem] 2xl:gap-3 2xl:px-[1.375rem] 2xl:py-[1.125rem] ${
              data.format === formatItem.id
                ? 'border-[#18181B] bg-[#3C8527] shadow-[inset_0_-0.25rem_#1D4D13,inset_0.1875rem_0.1875rem_rgba(255,255,255,0.2),inset_-0.1875rem_-0.4375rem_rgba(255,255,255,0.1)]'
                : 'border-[#18181B] bg-[#1E1E1F] shadow-[inset_0.125rem_0.125rem_rgba(255,255,255,0.05)] hover:bg-[#2A2A2C]'
            }`}
          >
            <div className="flex h-[2.625rem] w-[2.625rem] shrink-0 items-center justify-center rounded-sm border-2 border-[#18181B] bg-black/40 p-[0.5625rem] shadow-[inset_0.125rem_0.125rem_rgba(255,255,255,0.1)] sm:h-[2.875rem] sm:w-[2.875rem] sm:p-[0.625rem] 2xl:h-[3.125rem] 2xl:w-[3.125rem] 2xl:p-[0.6875rem]">
              <formatItem.icon
                className={`h-[1.25rem] w-[1.25rem] sm:h-[1.375rem] sm:w-[1.375rem] 2xl:h-[1.625rem] 2xl:w-[1.625rem] ${
                  data.format === formatItem.id
                    ? 'text-white drop-shadow-[0_0_0.5rem_rgba(255,255,255,0.5)]'
                    : formatItem.color
                }`}
              />
            </div>

            <div className="flex min-w-0 max-w-[14rem] flex-col items-center justify-center overflow-hidden">
              <div
                className={`w-full text-[0.875rem] font-bold leading-[1.2] tracking-[0.06em] sm:text-[0.9375rem] 2xl:text-[1.0625rem] ${
                  data.format === formatItem.id ? 'text-white text-shadow' : 'text-[#D0D1D4]'
                }`}
              >
                {formatItem.label}
              </div>
              <div
                className={`mt-[0.3125rem] line-clamp-2 w-full text-[0.71875rem] leading-[1.4] sm:mt-[0.375rem] sm:text-[0.75rem] 2xl:text-[0.8125rem] ${
                  data.format === formatItem.id ? 'text-white' : 'text-[#B1B2B5]'
                }`}
              >
                {formatItem.desc}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-1 grid gap-4 rounded-sm border-2 border-[#18181B] bg-[#313233] p-4 shadow-[inset_0_0.25rem_0.5rem_-0.125rem_rgba(0,0,0,0.3)] sm:gap-5 sm:p-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center xl:gap-6 2xl:p-6">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-2 sm:gap-x-5">
          <div className="flex h-[3rem] w-[3rem] shrink-0 items-center justify-center rounded-sm border-2 border-[#18181B] bg-[#1E1E1F] p-[0.6875rem] text-[#A855F7] shadow-[inset_0.125rem_0.125rem_rgba(255,255,255,0.1)] sm:h-[3.25rem] sm:w-[3.25rem] sm:p-[0.75rem]">
            <Sparkles className="h-[1.5rem] w-[1.5rem] sm:h-[1.625rem] sm:w-[1.625rem]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold leading-[1.2] tracking-[0.08em] text-[#D0D1D4] sm:text-base 2xl:text-[1.0625rem]">
              {t('instanceExport.optimization.manifest.title', {
                defaultValue: 'MANIFEST MODE',
              })}
            </div>
            <div className="mt-[0.5rem] space-y-[0.375rem] text-[0.78125rem] leading-[1.7] text-[#B1B2B5] sm:mt-[0.625rem] sm:text-[0.8125rem] 2xl:text-sm">
              <p>
                {t('instanceExport.optimization.manifest.primary', {
                  defaultValue:
                    'Prefer platform references over bundling mod files when the source can be resolved.',
                })}
              </p>
              <p className="text-[#3C8527]">
                {t('instanceExport.optimization.manifest.fallback', {
                  defaultValue:
                    'Mods without a recoverable platform reference stay inside the archive as fallbacks.',
                })}
              </p>
              {manifestLocked && (
                <p className="text-[#FFE866]">
                  {t('instanceExport.optimization.manifest.pipackLocked', {
                    defaultValue:
                      'PiPack always writes `pi_manifest.json` and only bundles mods that cannot be restored from their source platform.',
                  })}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end self-center xl:justify-start">
          <OreSwitch
            checked={manifestChecked}
            onChange={(checked) => onChange({ manifestMode: checked })}
            disabled={manifestLocked}
            className="scale-[1.05] 2xl:scale-[1.125]"
          />
        </div>
      </div>
    </div>
  );
};
