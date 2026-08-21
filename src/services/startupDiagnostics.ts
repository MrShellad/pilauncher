import { invoke } from '@tauri-apps/api/core';

const startedAt = performance.now();
const recordedMarks = new Set<string>();
let observedLongTasks = 0;

const elapsed = () => Math.round(performance.now() - startedAt);

export const markStartup = (stage: string) => {
  if (recordedMarks.has(stage)) return;
  recordedMarks.add(stage);

  const timing = elapsed();
  performance.mark(`pilauncher:${stage}`);
  console.info(`[Startup] +${timing}ms ${stage}`);

  void invoke('record_startup_mark', { mark: `${stage} (+${timing}ms)` }).catch((error) => {
    console.debug('[Startup] Native trace marker was skipped:', error);
  });
};

export const installStartupDiagnostics = () => {
  markStartup('frontend.module_evaluated');

  const markDomReady = () => markStartup('frontend.dom_content_loaded');
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markDomReady, { once: true });
  } else {
    markDomReady();
  }

  window.addEventListener('load', () => markStartup('frontend.window_loaded'), { once: true });

  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) {
        if (entry.duration < 50 || observedLongTasks >= 10) continue;

        observedLongTasks += 1;
        markStartup(`frontend.long_task_${observedLongTasks}_${Math.round(entry.duration)}ms`);
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
  } catch {
    // WebView2 versions without Long Task support still retain the core markers.
  }
};
