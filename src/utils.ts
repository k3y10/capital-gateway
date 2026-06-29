export const shortenWalletAddress = (address: string, edge = 4) => address ? `${address.slice(0, edge + 2)}...${address.slice(-edge)}` : "Not configured";

export const formatUSDC = (amount: number) => `${new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(amount)} USDC`;
