import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TelemetryItem {
  label: string;
  value: string | null;
  desc: string;
}

interface TelemetryPanelProps {
  showTelemetry: boolean;
  telemetryItems: TelemetryItem[];
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ showTelemetry, telemetryItems }) => {
  return (
    <AnimatePresence>
      {showTelemetry && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-[#1E1E1F] border-b border-black/40 overflow-hidden shrink-0 z-10"
        >
          <div className="p-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {telemetryItems.map((item, idx) => (
              <div key={idx} className="bg-[#18181B] p-2 border border-white/5 rounded-sm flex flex-col justify-center">
                <div className="text-[10px] text-ore-text-muted mb-0.5">{item.desc}</div>
                <div className={`text-xs font-bold truncate ${item.value ? 'text-ore-green' : 'text-gray-600'}`}>
                  {item.value || 'Wait...'}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
