// Minimal React/JSX shims for the admin TypeScript environment
// This file provides lightweight declarations so TS can parse JSX files

declare module 'react' {
  const React: any;
  export default React;
  export const useState: any;
  export const useEffect: any;
  export const useCallback: any;
  export const useMemo: any;
  export const useRef: any;
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props?: any, key?: any): any;
  export function jsxs(type: any, props?: any, key?: any): any;
  export function jsxDEV(type: any, props?: any, key?: any): any;
}

// Allow any intrinsic element in JSX to avoid strict typings in admin pages
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
