import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const modelCache = new Map<string, GLTF>();
const textureCache = new Map<string, THREE.Texture>();

export async function loadModrinthModel(modelUrl: string): Promise<GLTF> {
  const cached = modelCache.get(modelUrl);
  if (cached) return cached;

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(modelUrl);
  modelCache.set(modelUrl, gltf);
  return gltf;
}

export async function loadModrinthAnimationSource(source: string | Blob): Promise<GLTF> {
  if (typeof source === 'string') {
    return loadModrinthModel(source);
  }

  const objectUrl = URL.createObjectURL(source);
  try {
    const loader = new GLTFLoader();
    return await loader.loadAsync(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function loadModrinthTexture(textureUrl: string): Promise<THREE.Texture> {
  const cached = textureCache.get(textureUrl);
  if (cached) return cached;

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const texture = await loader.loadAsync(textureUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  textureCache.set(textureUrl, texture);
  return texture;
}

export function createTransparentTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  canvas.getContext('2d')?.clearRect(0, 0, 1, 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

export function applyPlayerTexture(model: THREE.Object3D, texture: THREE.Texture): void {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.name === 'cape') continue;

      material.map = texture;
      material.color.set(0xffffff);
      material.metalness = 0;
      material.roughness = 1;
      material.toneMapped = false;
      material.flatShading = true;
      material.depthTest = true;
      material.depthWrite = true;
      material.side = THREE.DoubleSide;
      material.alphaTest = 0.1;
      material.needsUpdate = true;
    }
  });
}

export function applyCapeTexture(
  model: THREE.Object3D,
  texture: THREE.Texture | null,
  transparentTexture: THREE.Texture,
): void {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.name !== 'cape') continue;

      material.map = texture ?? transparentTexture;
      material.transparent = !texture;
      material.visible = !!texture;
      material.color.set(0xffffff);
      material.metalness = 0;
      material.roughness = 1;
      material.toneMapped = false;
      material.flatShading = true;
      material.depthTest = true;
      material.depthWrite = true;
      material.side = THREE.DoubleSide;
      material.alphaTest = 0.1;
      material.needsUpdate = true;
    }
  });
}

export function cloneModelScene(scene: THREE.Object3D): THREE.Object3D {
  const clone = scene.clone(true);
  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    mesh.geometry = mesh.geometry.clone();
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => material.clone())
      : mesh.material.clone();
  });
  return clone;
}

export function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();

    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        material.dispose();
      }
    }
  });
}
