import { useCallback, useEffect, useState } from "react";
import { BASE_CHAIN_ID } from "./config";
import type { WalletAddress, WalletProviderName } from "./types";

function pickProvider(providerName?: WalletProviderName) {
  const root = window.ethereum;
  if (!root) return undefined;
  const providers = root.providers ?? [root];
  if (providerName === "Coinbase Wallet") return providers.find((provider) => provider.isCoinbaseWallet) ?? root;
  if (providerName === "MetaMask") return providers.find((provider) => provider.isMetaMask) ?? root;
  return root;
}

function detectProviderName(provider?: EthereumProvider): WalletProviderName {
  if (provider?.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider?.isMetaMask) return "MetaMask";
  return "Injected Wallet";
}

export function useWalletState() {
  const [address, setAddress] = useState<WalletAddress | "">("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "unavailable">("idle");
  const [providerName, setProviderName] = useState<WalletProviderName | undefined>(undefined);

  useEffect(() => {
    if (window.ethereum) {
      void Promise.all([window.ethereum.request({ method: "eth_accounts" }), window.ethereum.request({ method: "eth_chainId" })]).then(([accountValue, chainValue]) => {
        const accounts = accountValue as string[];
        setAddress((accounts[0] || "") as WalletAddress | "");
        setChainId(Number.parseInt(chainValue as string, 16));
        setStatus(accounts[0] ? "connected" : "idle");
        if (accounts[0]) setProviderName(detectProviderName(window.ethereum));
      });
    }

    const accounts = (value: unknown) => {
      const list = value as string[];
      setAddress((list[0] || "") as WalletAddress | "");
      setStatus(list[0] ? "connected" : "idle");
    };
    const chain = (value: unknown) => setChainId(Number.parseInt(value as string, 16));

    window.ethereum?.on?.("accountsChanged", accounts);
    window.ethereum?.on?.("chainChanged", chain);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", accounts);
      window.ethereum?.removeListener?.("chainChanged", chain);
    };
  }, []);

  const connect = useCallback(async (requestedProvider?: WalletProviderName) => {
    const provider = pickProvider(requestedProvider);
    if (!provider) {
      setStatus("unavailable");
      return;
    }

    setStatus("connecting");
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      setAddress((accounts[0] || "") as WalletAddress | "");
      const nextChainId = await provider.request({ method: "eth_chainId" }) as string;
      setChainId(Number.parseInt(nextChainId, 16));
      setProviderName(requestedProvider ?? detectProviderName(provider));
      setStatus(accounts[0] ? "connected" : "idle");
    } catch {
      setStatus("idle");
    }
  }, []);

  const switchToBase = useCallback(async () => {
    if (!window.ethereum) return;
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${BASE_CHAIN_ID.toString(16)}` }] });
    setChainId(BASE_CHAIN_ID);
  }, []);

  return {
    address,
    chainId,
    status,
    providerName,
    isConnected: Boolean(address),
    isWrongNetwork: Boolean(address && chainId !== BASE_CHAIN_ID),
    connect,
    switchToBase,
    disconnect: () => {
      setAddress("");
      setStatus("idle");
      setProviderName(undefined);
    },
  };
}
