import { useState } from "react";
import { Operation } from "@stellar/stellar-sdk";
import { useStellar } from "../providers/StellarProvider";
import { StellarError, TransactionResult } from "../types";

export function useLiquidityPoolActions() {
  const { server, adapter, publicKey } = useStellar();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<StellarError | null>(null);
  const [result, setResult] = useState<TransactionResult | null>(null);

  const deposit = async (o: {
    poolId: string;
    maxAmountA: string;
    maxAmountB: string;
    minPrice: string | { n: number; d: number };
    maxPrice: string | { n: number; d: number };
  }): Promise<TransactionResult | null> => {
    if (!server || !adapter || !publicKey) {
      setError(new Error("StellarProvider not initialized") as StellarError);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const account = await server.loadAccount(publicKey);
      const op = Operation.liquidityPoolDeposit({
        liquidityPoolId: o.poolId,
        maxAmountA: o.maxAmountA,
        maxAmountB: o.maxAmountB,
        minPrice: o.minPrice,
        maxPrice: o.maxPrice,
      });

      const { signedTx } = await adapter.signTransaction({
        transaction: op,
        account,
      });
      
      const res = await server.submitTransaction(signedTx);
      const txResult = { ...res, status: res.successful ? "success" : "error" } as TransactionResult;
      setResult(txResult);
      return txResult;
    } catch (err) {
      setError(err as StellarError);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const withdraw = async (o: {
    poolId: string;
    amount: string;
    minAmountA: string;
    minAmountB: string;
  }): Promise<TransactionResult | null> => {
    if (!server || !adapter || !publicKey) {
      setError(new Error("StellarProvider not initialized") as StellarError);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const account = await server.loadAccount(publicKey);
      const op = Operation.liquidityPoolWithdraw({
        liquidityPoolId: o.poolId,
        amount: o.amount,
        minAmountA: o.minAmountA,
        minAmountB: o.minAmountB,
      });

      const { signedTx } = await adapter.signTransaction({
        transaction: op,
        account,
      });

      const res = await server.submitTransaction(signedTx);
      const txResult = { ...res, status: res.successful ? "success" : "error" } as TransactionResult;
      setResult(txResult);
      return txResult;
    } catch (err) {
      setError(err as StellarError);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setError(null);
    setResult(null);
    setLoading(false);
  };

  return { deposit, withdraw, loading, error, result, reset };
}