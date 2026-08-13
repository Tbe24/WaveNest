// hls.js ships the light runtime as a public export but does not attach its
// existing declarations to that subpath. The light build uses the same API.
declare module 'hls.js/light' {
  export { default } from 'hls.js';
  export * from 'hls.js';
}
