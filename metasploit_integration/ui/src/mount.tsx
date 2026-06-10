import { createRoot, Root } from 'react-dom/client';
import App from './App';

let root: Root | null = null;

export const mount = (el: HTMLElement, props: any) => {
    root = createRoot(el);
    root.render(<App {...props} />);
};

export const unmount = (_el: HTMLElement) => {
    if (root) {
        root.unmount();
        root = null;
    }
};
