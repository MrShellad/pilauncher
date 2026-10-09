// src/features/settings/components/tabs/account/DonorSkinModal.tsx
import React, { useEffect, useRef } from 'react';
import { SkinEngine } from '@/features/wardrobe';
import * as THREE from 'three';
import { OreModal } from '../../../../../ui/primitives/OreModal';
import { Crown } from 'lucide-react';

export interface DonorInfo {
  mcUuid: string;
  mcName: string;
  amount?: number;
}

interface DonorSkinModalProps {
  isOpen: boolean;
  onClose: () => void;
  donor: DonorInfo | null;
}

/** 根据赞助金额返回对应的 tier 颜色 */
export function getDonorTierColor(amount: number): string {
  if (amount >= 100) return '#FFD700'; // Gold
  if (amount >= 50) return '#C77DFF';  // Purple
  if (amount >= 10) return '#64DFDF';  // Cyan
  return '#AAAAAA';                    // Silver
}

/** 创建一个 Minecraft 风格的像素皇冠模型 */
function createBlockyCrown(): THREE.Group {
  const crown = new THREE.Group();
  crown.name = 'donor-crown';

  const gold = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
  const darkGold = new THREE.MeshLambertMaterial({ color: 0xB8860B });
  const ruby = new THREE.MeshLambertMaterial({ color: 0xE31B23 });
  const emerald = new THREE.MeshLambertMaterial({ color: 0x50C878 });

  // Base band (slightly wider than the 8-unit head)
  const band = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1, 8.6), gold);
  band.position.y = 4.5;
  crown.add(band);

  // Corner prongs
  const prongGeo = new THREE.BoxGeometry(1.5, 2.5, 1.5);
  const corners: [number, number, number][] = [
    [-3, 6.25, -3], [3, 6.25, -3],
    [-3, 6.25, 3],  [3, 6.25, 3],
  ];
  corners.forEach(([x, y, z]) => {
    const prong = new THREE.Mesh(prongGeo, darkGold);
    prong.position.set(x, y, z);
    crown.add(prong);

    const gem = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), ruby);
    gem.position.set(x, y + 1.7, z);
    crown.add(gem);
  });

  // Center tall prong
  const centerProng = new THREE.Mesh(new THREE.BoxGeometry(2, 3.5, 2), darkGold);
  centerProng.position.set(0, 6.75, 0);
  crown.add(centerProng);

  const centerGem = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), emerald);
  centerGem.position.set(0, 9, 0);
  crown.add(centerGem);

  return crown;
}

export const DonorSkinModal: React.FC<DonorSkinModalProps> = ({ isOpen, onClose, donor }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !donor || !containerRef.current) return;

    const engine = SkinEngine.getOrCreate({ enableRandomIdle: true, targetFps: 60, idleFps: 60 });
    const container = containerRef.current;

    // Set engine canvas sizes and mount to container
    engine.setSize(280, 400);
    container.appendChild(engine.canvas);

    // Load donor skin
    const skinUrl = `https://minotar.net/skin/${donor.mcUuid}.png`;
    void engine.loadSkin(`donor-${donor.mcUuid}`, skinUrl, 'classic').then(() => {
      // Add crown to the head if gold tier
      const amount = donor.amount || 0;
      if (amount >= 100 && engine.raw.playerWrapper) {
        const headNode = engine.raw.playerWrapper.getObjectByName('Head');
        if (headNode) {
          // Remove old crown if any
          const oldCrown = headNode.getObjectByName('donor-crown');
          if (oldCrown) headNode.remove(oldCrown);

          const crown = createBlockyCrown();
          crown.scale.setScalar(0.0625); // Scale down 1/16 to match GLTF head scale
          crown.position.y = 0.25;      // Translate pivot from center to neck
          headNode.add(crown);
        }
      }
    });

    engine.startRenderLoop();

    // Auto rotate using playerWrapper
    let rotateTimerId: ReturnType<typeof setInterval>;
    if (engine.raw.playerWrapper) {
      rotateTimerId = setInterval(() => {
        if (!engine.isUserRotating) {
          engine.raw.playerWrapper.rotation.y += 0.015;
        }
      }, 16);
    }

    return () => {
      if (rotateTimerId) clearInterval(rotateTimerId);
      engine.stopRenderLoop();
      if (container.contains(engine.canvas)) {
        container.removeChild(engine.canvas);
      }
      // Remove crown from head
      if (engine.raw.playerWrapper) {
        const headNode = engine.raw.playerWrapper.getObjectByName('Head');
        if (headNode) {
          const oldCrown = headNode.getObjectByName('donor-crown');
          if (oldCrown) headNode.remove(oldCrown);
        }
      }
    };
  }, [isOpen, donor]);

  if (!donor) return null;

  const amount = donor.amount || 0;
  const isGold = amount >= 100;
  const tierColor = getDonorTierColor(amount);

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={donor.mcName || 'Anonymous'}
      className="w-[340px]"
    >
      <div className="flex flex-col items-center gap-4 py-2">
        {/* 3D 皮肤查看器 */}
        <div
          ref={containerRef}
          className={`relative rounded-lg overflow-hidden cursor-grab active:cursor-grabbing w-[280px] h-[400px] ${
            isGold
              ? 'ring-2 ring-[#FFD700]/60 shadow-[0_0_24px_rgba(255,215,0,0.25)]'
              : 'ring-1 ring-white/10'
          }`}
          style={{ background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 100%)' }}
        />

        {/* Tier 标识 */}
        {isGold && (
          <div className="flex items-center gap-1.5 text-[#FFD700] font-minecraft text-sm animate-pulse">
            <Crown size={14} />
            <span>尊贵赞助者</span>
            <Crown size={14} />
          </div>
        )}

        {/* 名字和金额 */}
        <div className="text-center">
          <span className="font-minecraft text-lg" style={{ color: tierColor }}>
            {donor.mcName || 'Anonymous'}
          </span>
        </div>
      </div>
    </OreModal>
  );
};
