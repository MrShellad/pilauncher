import * as THREE from 'three';

import classicPlayerModelUrl from '../../../assets/models/classic-player.gltf?url';
import slimPlayerModelUrl from '../../../assets/models/slim-player.gltf?url';
import type { SkinModelVariant } from './skinEngineTypes';

export const FRONT_ROTATION_Y = Math.PI;
export const CAMERA_POSITION = new THREE.Vector3(0, 1.26, -4.15);
export const CAMERA_TARGET = new THREE.Vector3(0, 0.98, 0);
export const MODEL_SCALE = 0.76;

export const toModelVariant = (
  model?: SkinModelVariant | 'auto-detect',
): SkinModelVariant => model === 'slim' ? 'slim' : 'classic';

export const modelUrlForVariant = (model: SkinModelVariant): string =>
  model === 'slim' ? slimPlayerModelUrl : classicPlayerModelUrl;

export const createSpotlightMaterial = (): THREE.ShaderMaterial => new THREE.ShaderMaterial({
  uniforms: {
    innerColor: { value: new THREE.Color(0x000000) },
    outerColor: { value: new THREE.Color(0xffffff) },
    innerOpacity: { value: 0.3 },
    outerOpacity: { value: 0.0 },
    falloffPower: { value: 1.2 },
    shadowRadius: { value: 7 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 innerColor;
    uniform vec3 outerColor;
    uniform float innerOpacity;
    uniform float outerOpacity;
    uniform float falloffPower;
    uniform float shadowRadius;
    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5, 0.5);
      float dist = distance(vUv, center) * 2.0;
      float shadowFalloff = 1.0 - smoothstep(0.0, shadowRadius, dist);
      float spotlightFalloff = 1.0 - smoothstep(0.0, 1.0, pow(dist, falloffPower));
      vec3 color = mix(outerColor, innerColor, shadowFalloff);
      float opacity = mix(outerOpacity, innerOpacity * shadowFalloff, spotlightFalloff);
      gl_FragColor = vec4(color, opacity);
    }
  `,
  transparent: true,
  depthWrite: false,
  depthTest: false,
});

export const getVisibleMeshBox = (root: THREE.Object3D): THREE.Box3 | null => {
  const parent = root.parent;
  if (parent) {
    parent.remove(root);
  }

  root.updateMatrixWorld(true);

  const result = new THREE.Box3();
  const meshBox = new THREE.Box3();
  let found = false;

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || mesh.visible === false) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.length && materials.every((material) => material.visible === false)) return;

    if (!mesh.geometry.boundingBox) {
      mesh.geometry.computeBoundingBox();
    }
    if (!mesh.geometry.boundingBox) return;

    meshBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    result.union(meshBox);
    found = true;
  });

  if (parent) {
    parent.add(root);
  }

  return found && !result.isEmpty() ? result.clone() : null;
};
