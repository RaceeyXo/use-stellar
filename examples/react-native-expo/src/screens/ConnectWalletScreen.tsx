import { Pressable, StyleSheet, Text, View } from "react-native"
import { useWallet } from "@use-stellar/react-native"
import { walletConnectProjectId } from "../config"

export function ConnectWalletScreen() {
  const { connected, connecting, address, error, connect, disconnect } = useWallet()

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Connect wallet</Text>
      <Text style={styles.meta}>
        WalletConnect projectId is{" "}
        {walletConnectProjectId ? "set" : "missing (set EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID)"}
      </Text>
      {connected ? (
        <>
          <Text>Connected: {address}</Text>
          <Pressable onPress={disconnect} style={styles.button}>
            <Text style={styles.buttonLabel}>Disconnect</Text>
          </Pressable>
        </>
      ) : (
        // Freighter and Albedo are browser wallets; on a phone, WalletConnect
        // hands signing to a mobile wallet app.
        <Pressable
          onPress={() => connect("walletconnect")}
          style={styles.button}
          disabled={connecting || !walletConnectProjectId}
        >
          <Text style={styles.buttonLabel}>{connecting ? "Connecting…" : "Connect"}</Text>
        </Pressable>
      )}
      {error ? <Text style={styles.error}>{error.message}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: 12, padding: 16 },
  title: { fontSize: 20, fontWeight: "600" },
  meta: { color: "#555" },
  button: { backgroundColor: "#0a7cff", padding: 12, borderRadius: 8 },
  buttonLabel: { color: "#fff", textAlign: "center" },
  error: { color: "#b00020" },
})
