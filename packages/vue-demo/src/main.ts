import { createApp } from "vue"
import { createStellarPlugin } from "@use-stellar/vue"
import App from "./App.vue"
import { registerDemoWallets } from "./wallets"
import "./style.css"

// Wallets are registered once, before the app mounts, and the list is handed
// to the app so the connect section offers exactly what was registered.
const wallets = registerDemoWallets()

createApp(App, { wallets })
  .use(
    createStellarPlugin({
      // Testnet only. The built-in Horizon and Soroban endpoints for it are used.
      network: "testnet",
    })
  )
  .mount("#app")
