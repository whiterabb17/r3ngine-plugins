import cytoscape from 'cytoscape';
import dagreRaw from 'cytoscape-dagre';
import fcoseRaw from 'cytoscape-fcose';

// CJS interop guard — both packages are UMD with no ESM build
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dagre = (dagreRaw as any).default ?? dagreRaw;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fcose = (fcoseRaw as any).default ?? fcoseRaw;

// Register layout extensions exactly once. Importing this module is idempotent.
cytoscape.use(dagre);
cytoscape.use(fcose);

export {};
