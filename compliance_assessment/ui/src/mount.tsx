// temporary placeholder — will be replaced in Task 6
import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

const roots = new WeakMap<HTMLElement, Root>();

export function mount(el: HTMLElement, _props: Record<string, unknown>): void {
  const root = createRoot(el);
  roots.set(el, root);
  root.render(<div>Compliance Assessment Loading...</div>);
}

export function unmount(el: HTMLElement): void {
  const root = roots.get(el);
  if (root) { root.unmount(); roots.delete(el); }
}
