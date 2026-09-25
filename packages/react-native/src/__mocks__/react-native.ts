/**
 * React Native Module Mock
 * ────────────────────────
 * Provides jest.fn() stubs for React Native's core modules and components.
 * 
 * This allows tests to run in a Node/jsdom environment without the native runtime.
 * Re-exports the real react-native but replaces native modules (AppState, Linking, etc.)
 * with controllable mocks from test-utils.
 */

import AppState from "../test-utils/mocks/AppState"
import NetInfo from "../test-utils/mocks/NetInfo"
import AsyncStorage from "../test-utils/mocks/AsyncStorage"
import Linking from "../test-utils/mocks/Linking"

// Get the real react-native implementation for components we don't need to mock
const actual = jest.requireActual("react-native")

/**
 * Mock the standard React Native exports.
 * Components like View, Text, etc. pass through unchanged.
 * Native module singletons (AppState, Linking) use test mocks.
 */
export const {
  View,
  Text,
  ScrollView,
  FlatList,
  SectionList,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
  SafeAreaView,
  useWindowDimensions,
} = actual

export { AppState, Linking, AsyncStorage, NetInfo }

/**
 * Mock Platform module with testnet environment.
 * Tests run on "ios" by default (can be overridden per test).
 */
export const MockPlatform = {
  OS: "ios",
  Version: 14,
  select: (obj: Record<string, unknown>) => obj.ios,
}

export default {
  ...actual,
  AppState,
  Linking,
  AsyncStorage,
  NetInfo,
  Platform: MockPlatform,
}
