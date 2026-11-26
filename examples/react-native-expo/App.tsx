import { useState } from "react"
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native"
import { StellarProvider } from "@use-stellar/react-native"
import { walletConnectProjectId } from "./src/config"
import { BalanceScreen } from "./src/screens/BalanceScreen"
import { ConnectWalletScreen } from "./src/screens/ConnectWalletScreen"
import { PaymentHistoryScreen } from "./src/screens/PaymentHistoryScreen"
import { SendPaymentScreen } from "./src/screens/SendPaymentScreen"
import { SorobanReadScreen } from "./src/screens/SorobanReadScreen"
import { SorobanWriteScreen } from "./src/screens/SorobanWriteScreen"

type Screen = "connect" | "balance" | "history" | "send" | "soroban-read" | "soroban-write"

function ExampleApp() {
  const [screen, setScreen] = useState<Screen>("connect")

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.heading}>use-stellar Expo (testnet)</Text>
      <ScrollView horizontal style={styles.nav} showsHorizontalScrollIndicator={false}>
        {(
          [
            ["connect", "Wallet"],
            ["balance", "Balance"],
            ["history", "History"],
            ["send", "Send"],
            ["soroban-read", "Read"],
            ["soroban-write", "Write"],
          ] as const
        ).map(([id, label]) => (
          <Pressable key={id} onPress={() => setScreen(id)} style={styles.navItem}>
            <Text style={screen === id ? styles.navActive : undefined}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {screen === "history" ? (
        <PaymentHistoryScreen />
      ) : (
        <ScrollView>
          {screen === "connect" ? <ConnectWalletScreen /> : null}
          {screen === "balance" ? <BalanceScreen /> : null}
          {screen === "send" ? <SendPaymentScreen /> : null}
          {screen === "soroban-read" ? <SorobanReadScreen /> : null}
          {screen === "soroban-write" ? <SorobanWriteScreen /> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

// Static, so the provider registers WalletConnect once rather than per render.
const walletConnect = walletConnectProjectId
  ? {
      projectId: walletConnectProjectId,
      metadata: {
        name: "use-stellar Expo example",
        description: "use-stellar on React Native (testnet)",
        url: "https://github.com/RaceeyXo/use-stellar",
        icons: [],
      },
    }
  : undefined

export default function App() {
  return (
    // `autoConnect` restores the WalletConnect session through AsyncStorage on
    // the next launch, without pairing again.
    <StellarProvider network="testnet" autoConnect walletConnect={walletConnect}>
      <ExampleApp />
    </StellarProvider>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  heading: { fontSize: 22, fontWeight: "700", padding: 16 },
  nav: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 8 },
  navItem: { paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 4 },
  navActive: { fontWeight: "700" },
})
