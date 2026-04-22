// src/features/Settings/components/tabs/AS/DonorSkinModal.tsx
import React, { useEffect, useRef } from 'react';
import { SkinViewer, IdleAnimation } from 'skinview3d';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);

  useEffect(() => {
    if (!isOpen || !donor || !canvasRef.current) return;

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width: 280,
      height: 400,
      skin: `https://minotar.net/skin/${donor.mcUuid}`,
    });

    viewer.animation = new IdleAnimation();
    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.8;
    viewer.controls.enableZoom = false;
    viewer.zoom = 0.9;
    viewer.fov = 50;

    // 为金色赞助者添加皇冠
    const amount = donor.amount || 0;
    if (amount >= 100) {
      const crown = createBlockyCrown();
      viewer.playerObject.skin.head.add(crown as any);
    }

    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
      viewerRef.current = null;
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
          className={`relative rounded-lg overflow-hidden cursor-grab active:cursor-grabbing ${
            isGold
              ? 'ring-2 ring-[#FFD700]/60 shadow-[0_0_24px_rgba(255,215,0,0.25)]'
              : 'ring-1 ring-white/10'
          }`}
          style={{ background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 100%)' }}
        >
          <canvas ref={canvasRef} className="block" />
        </div>

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
