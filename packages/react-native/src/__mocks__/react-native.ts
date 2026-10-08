/**
 * React Native Module Mock
 * ────────────────────────
 * A lightweight stand-in for `react-native` in Jest.
 *
 * Host components are plain strings, which react-test-renderer renders as host
 * elements — exactly what @testing-library/react-native needs to detect `Text`,
 * `TextInput`, etc. Native module singletons (AppState, Linking) are the
 * controllable doubles from `test-utils/mocks`.
 *
 * The real `react-native` package is never loaded: its Flow sources and
 * TurboModule bindings need the native runtime, and nothing under test depends
 * on them.
 */

import AppState from "../test-utils/mocks/AppState"
import Linking from "../test-utils/mocks/Linking"
import NetInfo from "../test-utils/mocks/NetInfo"
import AsyncStorage from "../test-utils/mocks/AsyncStorage"

export const View = "View"
export const Text = "Text"
export const TextInput = "TextInput"
export const Image = "Image"
export const Switch = "RCTSwitch"
export const ScrollView = "RCTScrollView"
export const Modal = "Modal"
export const SafeAreaView = "RCTSafeAreaView"
export const FlatList = "RCTFlatList"
export const SectionList = "RCTSectionList"
export const StatusBar = "StatusBar"

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: (style: unknown) => style,
  hairlineWidth: 1,
}

export const Platform = {
  OS: "ios" as const,
  Version: 17,
  select: <T>(obj: { ios?: T; android?: T; native?: T; default?: T }): T | undefined =>
    obj.ios ?? obj.native ?? obj.default,
}

export const Dimensions = {
  get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
  addEventListener: () => ({ remove: () => {} }),
}

export const useWindowDimensions = () => Dimensions.get()

export { AppState, Linking, AsyncStorage, NetInfo }
