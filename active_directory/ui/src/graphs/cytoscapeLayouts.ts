import './cytoscapeExtensions';
import type { LayoutName } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LAYOUT_CONFIGS: Record<LayoutName, any> = {
  dagre: {
    name: 'dagre',
    rankDir: 'TB',
    nodeSep: 60,
    rankSep: 90,
    padding: 40,
    animate: true,
    animationDuration: 450,
    fit: false,
  },
  fcose: {
    name: 'fcose',
    quality: 'default',
    randomize: false,
    animate: true,
    animationDuration: 450,
    nodeSeparation: 75,
    fit: false,
  },
  circle: {
    name: 'circle',
    padding: 40,
    animate: true,
    animationDuration: 450,
    fit: false,
  },
  concentric: {
    name: 'concentric',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    concentric: (node: any) => {
      const t = node.data('type') as string;
      if (t === 'ADForest') return 5;
      if (t === 'ADDomain') return 4;
      if (t === 'ADIdentityProvider' || t === 'ADAuthService') return 3;
      if (t === 'ADUser' || t === 'ADGroup' || t === 'ADComputer') return 2;
      return 1;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    levelWidth: (nodes: any) => Math.max(1, Math.ceil(nodes.length / 4)),
    padding: 40,
    animate: true,
    animationDuration: 450,
    fit: false,
  },
  grid: {
    name: 'grid',
    padding: 40,
    animate: true,
    animationDuration: 450,
    fit: false,
  },
};

export function getLayoutConfig(name: LayoutName, elementCount: number) {
  const base = LAYOUT_CONFIGS[name];
  if (elementCount > 400) {
    return { ...base, animate: false };
  }
  return base;
}
