<script setup lang="ts">
import { onMounted } from "vue"
import type { UseDemoWalletReturn } from "../composables/useDemoWallet"
import { accountUrl } from "../explorer"
import type { DemoWallet } from "../wallets"

const props = defineProps<{ wallet: UseDemoWalletReturn; wallets: DemoWallet[] }>()

const usable = () => props.wallets.filter(w => !w.unavailable).map(w => w.id)

onMounted(() => props.wallet.refreshAvailableWallets(usable()))

/** Why a wallet's button is off, or null when it can be clicked. */
function blocked(option: DemoWallet): string | null {
  if (option.unavailable) return option.unavailable
  if (!props.wallet.availableWallets.value.includes(option.id)) {
    return `${option.label} was not found in this browser.`
  }
  return null
}
</script>

<template>
  <section aria-labelledby="wallet-heading">
    <h2 id="wallet-heading">Wallet</h2>
    <p>Connect a Stellar wallet set to testnet. Freighter is the one this demo is checked with.</p>

    <template v-if="wallet.connected.value && wallet.address.value">
      <p>
        Connected with {{ wallet.walletName.value }}:
        <a :href="accountUrl(wallet.address.value)" target="_blank" rel="noopener noreferrer">
          <code>{{ wallet.address.value }}</code>
        </a>
      </p>
      <p v-if="wallet.isNetworkMismatch.value" class="error" role="alert">
        Your wallet is on {{ wallet.walletNetwork.value ?? "another network" }}. Switch it to testnet, then
        connect again. Nothing can be signed until you do.
      </p>
      <div class="actions">
        <button type="button" @click="wallet.disconnect()">Disconnect</button>
      </div>
    </template>

    <template v-else>
      <p v-if="wallet.connecting.value" role="status">Waiting for your wallet…</p>
      <ul class="wallets">
        <li v-for="option in wallets" :key="option.id">
          <button
            type="button"
            :disabled="wallet.connecting.value || blocked(option) !== null"
            @click="wallet.connect(option.id)"
          >
            Connect {{ option.label }}
          </button>
          <span v-if="blocked(option)" class="note">{{ blocked(option) }}</span>
        </li>
      </ul>
      <button type="button" class="quiet" @click="wallet.refreshAvailableWallets(usable())">
        Look for wallets again
      </button>
    </template>

    <p v-if="wallet.error.value" class="error" role="alert">{{ wallet.error.value.message }}</p>
  </section>
</template>
