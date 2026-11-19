// Entry of the Metro bundle test (scripts/metro-bundle-test.js): the two
// imports an app makes, in the order it makes them.
import "@use-stellar/react-native/polyfills"
import { StellarProvider, useWallet } from "@use-stellar/react-native"

globalThis.__USE_STELLAR_FIXTURE__ = { StellarProvider, useWallet }
