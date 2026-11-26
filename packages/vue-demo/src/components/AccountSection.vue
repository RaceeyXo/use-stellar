<script setup lang="ts">
import { computed } from "vue"
import { useAccountExists, useBalance, useFriendBot } from "@use-stellar/vue"
import { accountUrl, assetCode } from "../explorer"

const props = defineProps<{
  /** The account shown: the typed address, else the connected wallet's. */
  address: string | null
}>()
const typed = defineModel<string>("typed", { required: true })
const emit = defineEmits<{ funded: [] }>()

const address = computed(() => props.address)
const exists = useAccountExists({ address })
const balance = useBalance({ address })
const friendbot = useFriendBot()

async function fund() {
  if (!props.address) return
  try {
    await friendbot.fund(props.address)
    await Promise.all([exists.refetch(), balance.refetch()])
    emit("funded")
  } catch {
    // friendbot.error holds the reason and is shown below.
  }
}

async function refresh() {
  await Promise.all([exists.refetch(), balance.refetch()])
}

defineExpose({ refresh })
</script>

<template>
  <section aria-labelledby="account-heading">
    <h2 id="account-heading">Balance and account</h2>
    <p>Shows the connected wallet's account. Type a testnet address to look at another one.</p>

    <label>
      Public address
      <input v-model="typed" placeholder="G… (empty: the connected wallet)" autocomplete="off" spellcheck="false" />
    </label>

    <p v-if="!address">Connect a wallet or type an address.</p>
    <template v-else>
      <p>
        Account:
        <a :href="accountUrl(address)" target="_blank" rel="noopener noreferrer"><code>{{ address }}</code></a>
      </p>

      <p v-if="exists.loading.value || balance.loading.value" role="status">Loading account…</p>
      <p v-if="exists.error.value" class="error" role="alert">{{ exists.error.value.message }}</p>
      <p v-else-if="exists.reason.value === 'invalid_address'" class="error" role="alert">
        That is not a Stellar public address.
      </p>

      <template v-else-if="exists.exists.value === false">
        <p>This account does not exist on testnet yet. Friendbot can create it with test XLM.</p>
        <button type="button" :disabled="friendbot.loading.value" @click="fund">
          {{ friendbot.loading.value ? "Funding…" : "Fund with Friendbot" }}
        </button>
      </template>

      <template v-else-if="exists.exists.value">
        <p>
          XLM balance: <strong>{{ balance.balance.value ?? "0" }}</strong>
        </p>
        <table v-if="balance.balances.value.length">
          <caption>
            Every balance of the account
          </caption>
          <thead>
            <tr>
              <th scope="col">Asset</th>
              <th scope="col">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in balance.balances.value" :key="index">
              <td>{{ assetCode(row.asset) }}</td>
              <td>{{ row.balance }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="balance.error.value" class="error" role="alert">{{ balance.error.value.message }}</p>
      </template>

      <p v-if="friendbot.error.value" class="error" role="alert">{{ friendbot.error.value.message }}</p>
      <p v-if="friendbot.funded.value" role="status">Friendbot funded the account.</p>

      <div class="actions">
        <button type="button" class="quiet" @click="refresh">Refresh account</button>
      </div>
    </template>
  </section>
</template>
