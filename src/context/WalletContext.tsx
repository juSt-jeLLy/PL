import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ethers } from "ethers";
import { WORLD_CHAIN_SEPOLIA } from "@/lib/contract";

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | null;
  balance: string;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  isCorrectChain: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToWorldChainSepolia: () => Promise<void>;
}

const WalletContext = createContext<WalletState>({
  address: null,
  isConnected: false,
  isConnecting: false,
  chainId: null,
  balance: "0",
  provider: null,
  signer: null,
  isCorrectChain: false,
  connect: async () => {},
  disconnect: () => {},
  switchToWorldChainSepolia: async () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState("0");
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);

  const isConnected = !!address;
  const isCorrectChain = chainId === WORLD_CHAIN_SEPOLIA.chainId;

  const refreshBalance = useCallback(async (addr: string, prov: ethers.BrowserProvider) => {
    try {
      const bal = await prov.getBalance(addr);
      setBalance(parseFloat(ethers.formatEther(bal)).toFixed(4));
    } catch {
      setBalance("0");
    }
  }, []);

  const setupWallet = useCallback(async (prov: ethers.BrowserProvider) => {
    const net = await prov.getNetwork();
    setChainId(Number(net.chainId));
    const s = await prov.getSigner();
    const addr = await s.getAddress();
    setSigner(s);
    setAddress(addr);
    setProvider(prov);
    await refreshBalance(addr, prov);
  }, [refreshBalance]);

  // Auto-reconnect if already connected
  useEffect(() => {
    const tryAutoConnect = async () => {
      if (!window.ethereum) return;
      try {
        const accounts: string[] = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          const prov = new ethers.BrowserProvider(window.ethereum);
          await setupWallet(prov);
        }
      } catch {
        // ignore
      }
    };
    tryAutoConnect();
  }, [setupWallet]);

  // Listen for MetaMask events
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress(null);
        setSigner(null);
        setProvider(null);
        setChainId(null);
        setBalance("0");
      } else {
        if (provider) {
          const s = await provider.getSigner();
          const addr = await s.getAddress();
          setSigner(s);
          setAddress(addr);
          await refreshBalance(addr, provider);
        }
      }
    };

    const handleChainChanged = async (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16);
      setChainId(newChainId);
      if (provider && address) {
        await refreshBalance(address, provider);
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [provider, address, refreshBalance]);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }
    setIsConnecting(true);
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const prov = new ethers.BrowserProvider(window.ethereum);
      await setupWallet(prov);
    } catch (err) {
      console.error("Wallet connect failed:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [setupWallet]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setProvider(null);
    setChainId(null);
    setBalance("0");
  }, []);

  const switchToWorldChainSepolia = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: WORLD_CHAIN_SEPOLIA.chainIdHex }],
      });
    } catch (err: unknown) {
      // Chain not added yet — add it
      if ((err as { code?: number }).code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: WORLD_CHAIN_SEPOLIA.chainIdHex,
              chainName: WORLD_CHAIN_SEPOLIA.name,
              rpcUrls: [WORLD_CHAIN_SEPOLIA.rpcUrl],
              nativeCurrency: WORLD_CHAIN_SEPOLIA.nativeCurrency,
              blockExplorerUrls: [WORLD_CHAIN_SEPOLIA.blockExplorer],
            },
          ],
        });
      }
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected,
        isConnecting,
        chainId,
        balance,
        provider,
        signer,
        isCorrectChain,
        connect,
        disconnect,
        switchToWorldChainSepolia,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
