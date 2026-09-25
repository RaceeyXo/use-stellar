/**
 * React Native Mock Modules
 * ──────────────────────────
 * Central export point for all test mocks and helpers.
 * 
 * Tests import helpers from here:
 * 
 * @example
 * import { setAppState, setOnline, openUrl } from "@use-stellar/react-native/test-utils/mocks"
 */

// AppState helpers
export { setAppState, getAppState, getAppStateListenerCount, resetAppStateMock } from "./AppState"
export type { } from "./AppState"

// NetInfo helpers
export { setOnline, getNetInfoState, getNetInfoListenerCount, resetNetInfoMock } from "./NetInfo"
export type { NetInfoState } from "./NetInfo"

// AsyncStorage helpers
export {
  getAsyncStorageMap,
  getAsyncStorageValue,
  setAsyncStorageValue,
  resetAsyncStorageMock,
} from "./AsyncStorage"

// Linking helpers
export {
  openUrl,
  getOpenedUrls,
  setLinkingSuccess,
  getLastOpenedUrl,
  resetLinkingMock,
} from "./Linking"

// WalletConnect helpers
export {
  setWalletConnectConnected,
  isWalletConnectConnected,
  getWalletConnectSession,
  signWithWalletConnect,
  resetWalletConnectMock,
} from "./WalletConnect"
export type { MockWalletConnectSession } from "./WalletConnect"

// Runtime reset
export { resetAllMocks } from "./runtime"
