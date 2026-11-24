/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

/** Présent seulement dans l'appli Android (WebView) : voir android/…/MainActivity.java. */
interface PicoBridge {
  version(): string;
  setLandscape(on: boolean): void;
}
interface Window {
  PicoAndroid?: PicoBridge;
}
