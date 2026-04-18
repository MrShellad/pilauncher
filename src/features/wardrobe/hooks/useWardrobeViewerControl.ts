import { useCallback, useEffect, useRef } from 'react';
import { useSkinViewer, loadAccountSkin } from '../../home/hooks/useSkinViewer';
import type { SkinCardAsset, WardrobeSkinModel, WardrobeTab } from '../types';

export function useWardrobeViewerControl() {
  const { containerRef, getEngine } = useSkinViewer('wardrobe');
  const targetRotationRef = useRef<number>(0);

  const loadViewerState = useCallback(
    async (
      skinUrl: string | null,
      capeUrl: string | null,
      model: WardrobeSkinModel,
      section: WardrobeTab,
      currentAccount?: any
    ) => {
      const engine = getEngine();
      if (!engine) return;

      if (skinUrl) {
        await engine.loadSkin(`wardrobe-view-skin:${skinUrl}:${model}`, skinUrl, model);
      } else {
        await loadAccountSkin(engine, currentAccount);
        engine.setSkinModel(model);
      }

      if (capeUrl) {
        await engine.loadCape(`wardrobe-view-cape:${capeUrl}`, capeUrl);
      } else {
        engine.clearCape();
      }

      engine.raw.controls.target.set(0, 0, 0);
      engine.raw.controls.update();
      targetRotationRef.current = section === 'cape' ? Math.PI : 0;
    },
    [getEngine]
  );

  const syncViewerToCurrentState = useCallback(
    async (
      currentSkinUrl: string | null,
      activeCapeUrl: string | null,
      currentModel: WardrobeSkinModel,
      currentSection: WardrobeTab,
      currentAccount: any,
      sectionOverride?: WardrobeTab,
      modelOverride?: WardrobeSkinModel
    ) => {
      await loadViewerState(
        currentSkinUrl,
        activeCapeUrl,
        modelOverride ?? currentModel,
        sectionOverride ?? currentSection,
        currentAccount
      );
    },
    [loadViewerState]
  );

  const previewSkinAsset = useCallback(
    async (asset: SkinCardAsset, model: WardrobeSkinModel, activeCapeUrl: string | null) => {
      await loadViewerState(asset.skinUrl, activeCapeUrl, model, 'skin');
    },
    [loadViewerState]
  );

  useEffect(() => {
    let frameId = 0;
    const pollRightStick = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gamepad = gamepads.find((item): item is Gamepad => item !== null);
      const rightStickX = gamepad?.axes[2] ?? 0;
      const engine = getEngine();

      if (engine) {
        if (Math.abs(rightStickX) > 0.16) {
          const delta = rightStickX * 0.04;
          engine.raw.playerWrapper.rotation.y += delta;
          targetRotationRef.current = engine.raw.playerWrapper.rotation.y;
        } else {
          const diff = targetRotationRef.current - engine.raw.playerWrapper.rotation.y;
          if (Math.abs(diff) > 0.01) {
            engine.raw.playerWrapper.rotation.y += diff * 0.1;
          } else {
            engine.raw.playerWrapper.rotation.y = targetRotationRef.current;
          }
        }
      }

      frameId = window.requestAnimationFrame(pollRightStick);
    };

    frameId = window.requestAnimationFrame(pollRightStick);
    return () => window.cancelAnimationFrame(frameId);
  }, [getEngine]);

  return {
    containerRef,
    loadViewerState,
    syncViewerToCurrentState,
    previewSkinAsset,
  };
}
