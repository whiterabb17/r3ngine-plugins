import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import fcose from 'cytoscape-fcose';

// Register layout extensions exactly once. Importing this module is idempotent.
cytoscape.use(dagre);
cytoscape.use(fcose);

export {};
