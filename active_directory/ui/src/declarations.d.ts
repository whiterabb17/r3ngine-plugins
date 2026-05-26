declare module 'cytoscape-dagre' {
  import cytoscape from 'cytoscape';
  const ext: cytoscape.Ext;
  export default ext;
}

declare module 'cytoscape-fcose' {
  import cytoscape from 'cytoscape';
  const ext: cytoscape.Ext;
  export default ext;
}

declare module 'react-cytoscapejs' {
  import type cytoscape from 'cytoscape';
  import type { CSSProperties } from 'react';

  interface CytoscapeComponentProps {
    elements: cytoscape.ElementDefinition[];
    stylesheet?: cytoscape.StylesheetStyle[] | cytoscape.StylesheetCSS[];
    layout?: cytoscape.LayoutOptions;
    cy?: (cy: cytoscape.Core) => void;
    style?: CSSProperties;
    className?: string;
    [key: string]: unknown;
  }

  const CytoscapeComponent: (props: CytoscapeComponentProps) => JSX.Element;
  export default CytoscapeComponent;
}
