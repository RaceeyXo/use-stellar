import { useState } from "react"
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native"
import { StellarProvider } from "@use-stellar/react-native"
import { walletConnectProjectId } from "./src/config"
import { BalanceScreen } from "./src/screens/BalanceScreen"
import { ConnectWalletScreen } from "./src/screens/ConnectWalletScreen"
import { PaymentHistoryScreen } from "./src/screens/PaymentHistoryScreen"
import { SendPaymentScreen } from "./src/screens/SendPaymentScreen"

type Screen = "connect" | "balance" | "history" | "send"

function ExampleApp() {
  const [screen, setScreen] = useState<Screen>("connect")

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.heading}>use-stellar Expo (testnet)</Text>
      <View style={styles.nav}>
        {(
          [
            ["connect", "Wallet"],
            ["balance", "Balance"],
            ["history", "History"],
            ["send", "Send"],
          ] as const
        ).map(([id, label]) => (
          <Pressable key={id} onPress={() => setScreen(id)} style={styles.navItem}>
            <Text style={screen === id ? styles.navActive : undefined}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {screen === "history" ? (
        <PaymentHistoryScreen />
      ) : (
        <ScrollView>
          {screen === "connect" ? <ConnectWalletScreen /> : null}
          {screen === "balance" ? <BalanceScreen /> : null}
          {screen === "send" ? <SendPaymentScreen /> : null}
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
  nav: { flexDirection: "row", justifyContent: "space-around", paddingBottom: 8 },
  navItem: { padding: 8 },
  navActive: { fontWeight: "700" },
})
