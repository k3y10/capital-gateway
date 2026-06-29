const env = import.meta.env;
const first = (...values: Array<string | undefined>) => values.find((value) => value && value.trim())?.trim() ?? "";

export const BASE_CHAIN_ID = Number(first(env.VITE_CHAIN_ID, env.VITE_NEXT_PUBLIC_CHAIN_ID) || 8453);
export const USDC_CONTRACT_ADDRESS = first(env.VITE_USDC_CONTRACT_ADDRESS, env.VITE_NEXT_PUBLIC_USDC_CONTRACT_ADDRESS);
export const WALLETCONNECT_PROJECT_ID = first(env.VITE_WALLETCONNECT_PROJECT_ID, env.VITE_NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID);
