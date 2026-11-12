/**
 * Hermes startup polyfills for @use-stellar/react-native.
 * Keep this import first in the app entry (see index.js): the Stellar SDK reads
 * `crypto`, `Buffer`, `URL` and `TextEncoder` as soon as it loads.
 */
import "@use-stellar/react-native/polyfills"
