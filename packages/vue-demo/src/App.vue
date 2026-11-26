<script setup lang="ts">
import { computed, ref } from "vue"
import { useStellarRuntime } from "@use-stellar/vue"
import AccountSection from "./components/AccountSection.vue"
import PaymentHistorySection from "./components/PaymentHistorySection.vue"
import SendPaymentSection from "./components/SendPaymentSection.vue"
import SorobanSection from "./components/SorobanSection.vue"
import TrustlineSection from "./components/TrustlineSection.vue"
import WalletSection from "./components/WalletSection.vue"
import { useDemoWallet } from "./composables/useDemoWallet"
import type { DemoWallet } from "./wallets"

defineProps<{ wallets: DemoWallet[] }>()

const runtime = useStellarRuntime()
const wallet = useDemoWallet()

// The account the read sections show: what was typed, else the connected wallet.
const typedAddress = ref("")
const address = computed(() => typedAddress.value.trim() || wallet.address.value)

// The demo is testnet only: nothing is signed unless both the app and the wallet are on testnet.
const canSign = computed(
  () => runtime.network === "testnet" && wallet.connected.value && !wallet.isNetworkMismatch.value
)

const history = ref<InstanceType<typeof PaymentHistorySection> | null>(null)
const account = ref<InstanceType<typeof AccountSection> | null>(null)

/** A payment, a trustline or Friendbot changed the account: read it again. */
function accountChanged() {
  void account.value?.refresh()
  void history.value?.refetch()
}
</script>

<template>
  <main>
    <header>
      <div>
        <h1>use-stellar · Vue demo</h1>
        <p>A small wallet app on Stellar testnet, built from the <code>@use-stellar/vue</code> composables.</p>
      </div>
      <span class="badge">{{ runtime.network }}</span>
    </header>

    <WalletSection :wallet="wallet" :wallets="wallets" />
    <AccountSection
      ref="account"
      v-model:typed="typedAddress"
      :address="address"
      @funded="history?.refetch()"
    />
    <PaymentHistorySection ref="history" :address="address" />
    <SendPaymentSection :can-sign="canSign" @sent="accountChanged" />
    <TrustlineSection :can-sign="canSign" @added="accountChanged" />
    <SorobanSection />
  </main>
</template>
