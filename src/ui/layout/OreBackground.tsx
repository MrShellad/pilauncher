import React, { useEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import * as THREE from 'three';
import { useAccountStore } from '../../store/useAccountStore';
import { useGameLogStore } from '../../store/useGameLogStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import defaultBackground from '../../assets/home/wallpaper/1.webp';

type PanoramaSetPayload = {
  name: string;
  directory: string;
  faces: string[];
};

const MAX_PIXEL_RATIO = 2;
const CAMERA_LOOK_RADIUS = 10;

export const OreBackground: React.FC = () => {
  const { appearance } = useSettingsStore((state) => state.settings);
  const gameState = useGameLogStore((state) => state.gameState);
  const hasMicrosoftAccount = useAccountStore((state) =>
    state.accounts.some((account) => account.type?.toLowerCase() === 'microsoft'),
  );

  const [panoramaFaces, setPanoramaFaces] = useState<string[] | null>(null);
  const [panoramaReady, setPanoramaReady] = useState(false);
  const [windowActive, setWindowActive] = useState(() => !document.hidden && document.hasFocus());

  const panoramaContainerRef = useRef<HTMLDivElement | null>(null);
  const rotationSpeedRef = useRef(appearance.panoramaRotationSpeed);
  const rotationDirectionRef = useRef<1 | -1>(
    appearance.panoramaRotationDirection === 'counterclockwise' ? -1 : 1,
  );
  const yawRef = useRef(0);

  const canUsePanoramaFeature = appearance.panoramaEnabled && hasMicrosoftAccount;
  const shouldPauseRotation =
    !windowActive || gameState === 'launching' || gameState === 'running';
  const shouldPauseRotationRef = useRef(shouldPauseRotation);

  const bgUrl = useMemo(() => {
    if (appearance.backgroundImage) {
      try {
        return convertFileSrc(appearance.backgroundImage);
      } catch (error) {
        console.error('Failed to convert background image path:', error);
        return defaultBackground;
      }
    }
    return defaultBackground;
  }, [appearance.backgroundImage]);

  useEffect(() => {
    rotationSpeedRef.current = appearance.panoramaRotationSpeed;
  }, [appearance.panoramaRotationSpeed]);

  useEffect(() => {
    rotationDirectionRef.current =
      appearance.panoramaRotationDirection === 'counterclockwise' ? -1 : 1;
  }, [appearance.panoramaRotationDirection]);

  useEffect(() => {
    shouldPauseRotationRef.current = shouldPauseRotation;
  }, [shouldPauseRotation]);

  useEffect(() => {
    const syncWindowState = () => {
      setWindowActive(!document.hidden && document.hasFocus());
    };

    syncWindowState();
    document.addEventListener('visibilitychange', syncWindowState);
    window.addEventListener('focus', syncWindowState);
    window.addEventListener('blur', syncWindowState);
    return () => {
      document.removeEventListener('visibilitychange', syncWindowState);
      window.removeEventListener('focus', syncWindowState);
      window.removeEventListener('blur', syncWindowState);
    };
  }, []);

  useEffect(() => {
    if (!canUsePanoramaFeature) {
      setPanoramaFaces(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const sets = await invoke<PanoramaSetPayload[]>('list_background_panoramas');
        if (cancelled) return;
        setPanoramaFaces(sets[0]?.faces ?? null);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to read panorama background sets:', error);
        setPanoramaFaces(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canUsePanoramaFeature]);

  const panoramaUrls = useMemo(() => {
    if (!panoramaFaces || panoramaFaces.length !== 6) return null;
    try {
      return panoramaFaces.map((filePath) => convertFileSrc(filePath));
    } catch (error) {
      console.error('Failed to convert panorama face path:', error);
      return null;
    }
  }, [panoramaFaces]);

  useEffect(() => {
    setPanoramaReady(false);

    const container = panoramaContainerRef.current;
    if (!canUsePanoramaFeature || !panoramaUrls || !container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (error) {
      console.error('Failed to initialize panorama WebGL renderer:', error);
      return;
    }

    let disposed = false;
    let rafId = 0;
    let cubeTexture: THREE.CubeTexture | null = null;
    let yaw = yawRef.current;
    let lastFrameTime = performance.now();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 1);
    container.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 0.1);

    const renderCurrentFrame = (now: number) => {
      const verticalBob = Math.sin(now * 0.0002) * 0.15;
      camera.lookAt(
        Math.sin(yaw) * CAMERA_LOOK_RADIUS,
        verticalBob,
        Math.cos(yaw) * CAMERA_LOOK_RADIUS,
      );
      renderer.render(scene, camera);
    };

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth <= 0 || clientHeight <= 0) return;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      if (cubeTexture) {
        renderCurrentFrame(performance.now());
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const animate = (now: number) => {
      rafId = window.requestAnimationFrame(animate);

      if (shouldPauseRotationRef.current) {
        lastFrameTime = now;
        return;
      }

      const deltaSeconds = Math.min((now - lastFrameTime) / 1000, 0.2);
      lastFrameTime = now;
      yaw += rotationSpeedRef.current * rotationDirectionRef.current * deltaSeconds;
      renderCurrentFrame(now);
    };

    const textureLoader = new THREE.CubeTextureLoader();
    textureLoader.load(
      panoramaUrls,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }

        texture.colorSpace = THREE.SRGBColorSpace;
        cubeTexture = texture;
        scene.background = texture;
        setPanoramaReady(true);

        renderCurrentFrame(performance.now());
        lastFrameTime = performance.now();
        rafId = window.requestAnimationFrame(animate);
      },
      undefined,
      (error) => {
        if (disposed) return;
        console.error('Failed to load panorama textures:', error);
        setPanoramaReady(false);
      },
    );

    return () => {
      disposed = true;
      yawRef.current = yaw;
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      scene.background = null;
      cubeTexture?.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [canUsePanoramaFeature, panoramaUrls]);

  const shouldMountPanorama = canUsePanoramaFeature && !!panoramaUrls;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[#18181B]" />

      <img
        src={bgUrl}
        alt="OreLauncher Background"
        className="absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-in-out"
        style={{ filter: `blur(${appearance.backgroundBlur}px)` }}
      />

      {shouldMountPanorama && (
        <div
          ref={panoramaContainerRef}
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            filter: `blur(${appearance.backgroundBlur}px)`,
            opacity: panoramaReady ? 1 : 0,
          }}
        />
      )}

      <div
        className="absolute inset-0 transition-colors duration-500"
        style={{
          backgroundColor: appearance.maskColor,
          opacity: appearance.maskOpacity / 100,
        }}
      />

      {appearance.maskGradient && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80" />
      )}
    </div>
  );
};
