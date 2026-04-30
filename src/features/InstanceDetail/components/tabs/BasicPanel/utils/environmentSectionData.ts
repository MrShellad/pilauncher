import type {
  LoaderType,
  McVersionType,
} from '../../../../../Instances/logic/environmentSelection';
import {
  LOADER_TYPES,
  VERSION_TYPES,
} from '../../../../../Instances/logic/environmentSelection';

import vanillaIcon from '../../../../../../assets/icons/tags/loaders/vanilla.svg';
import fabricIcon from '../../../../../../assets/icons/tags/loaders/fabric.svg';
import quiltIcon from '../../../../../../assets/icons/tags/loaders/quilt.svg';
import forgeIcon from '../../../../../../assets/icons/tags/loaders/forge.svg';
import neoforgeIcon from '../../../../../../assets/icons/tags/loaders/neoforge.svg';

export const VERSION_TYPE_LABELS: Record<McVersionType, string> = {
  release: '正式版',
  snapshot: '快照',
  rc: '候选版',
  pre: '预览版',
  special: '特殊',
};

export const LOADER_ICON_MAP: Record<LoaderType, string> = {
  Vanilla: vanillaIcon,
  Fabric: fabricIcon,
  Forge: forgeIcon,
  NeoForge: neoforgeIcon,
  Quilt: quiltIcon,
};

export const ENVIRONMENT_LOADER_TYPES = LOADER_TYPES;
export const ENVIRONMENT_VERSION_TYPES = VERSION_TYPES;

export { vanillaIcon };
