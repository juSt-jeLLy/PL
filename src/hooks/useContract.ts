import { useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/context/WalletContext";
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  WORLD_CHAIN_SEPOLIA,
  OnChainBounty,
  OnChainRepo,
  STATUS_FROM_NUM,
  SEVERITY_FROM_NUM,
  mapRawBounty,
} from "@/lib/contract";

function getReadProvider() {
  return new ethers.JsonRpcProvider(WORLD_CHAIN_SEPOLIA.rpcUrl);
}

function getReadContract() {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, getReadProvider());
}

export function useContract() {
  const { signer, isConnected, isCorrectChain } = useWallet();
  const DEFAULT_DEADLINE_SECONDS = 10 * 24 * 60 * 60;

  const getWriteContract = useCallback(() => {
    if (!signer) throw new Error("Wallet not connected");
    if (!isCorrectChain) throw new Error("Wrong network — please switch to World Chain Sepolia");
    if (!CONTRACT_ADDRESS) throw new Error("Contract not deployed yet");
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  }, [signer, isCorrectChain]);

  // ── Contributor write functions ─────────────────────────────────────────────

  const registerRepo = useCallback(
    async (repoUrl: string, stakeEth: string) => {
      const contract = getWriteContract();
      const value = ethers.parseEther(stakeEth);
      const tx = await contract.registerRepo(
        repoUrl,
        DEFAULT_DEADLINE_SECONDS,
        DEFAULT_DEADLINE_SECONDS,
        DEFAULT_DEADLINE_SECONDS,
        { value }
      );
      const receipt = await tx.wait();
      const iface = new ethers.Interface(CONTRACT_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "RepoRegistered") return Number(parsed.args.repoId);
        } catch { /* skip */ }
      }
      return null;
    },
    [getWriteContract]
  );

  const batchCreateBounties = useCallback(
    async (
      repoId: number,
      issues: Array<{ url: string; id: string; title: string; description: string; amountEth: string; severity: number }>
    ) => {
      const contract = getWriteContract();
      const tx = await contract.batchCreateBounties(
        repoId,
        issues.map((i) => i.url),
        issues.map((i) => i.id),
        issues.map((i) => i.title),
        issues.map((i) => i.description),
        issues.map((i) => ethers.parseEther(i.amountEth)),
        issues.map((i) => i.severity)
      );
      await tx.wait();
      return tx.hash;
    },
    [getWriteContract]
  );

  const takeBounty = useCallback(
    async (bountyId: number, stakeEth: string) => {
      const contract = getWriteContract();
      const tx = await contract.takeBounty(bountyId, { value: ethers.parseEther(stakeEth) });
      await tx.wait();
      return tx.hash;
    },
    [getWriteContract]
  );

  const submitPR = useCallback(
    async (bountyId: number, prUrl: string) => {
      const contract = getWriteContract();
      const tx = await contract.submitPR(bountyId, prUrl);
      await tx.wait();
      return tx.hash;
    },
    [getWriteContract]
  );

  const claimBounty = useCallback(
    async (bountyId: number) => {
      const contract = getWriteContract();
      const tx = await contract.claimBounty(bountyId);
      await tx.wait();
      return tx.hash;
    },
    [getWriteContract]
  );

  const claimExpiredBounty = useCallback(
    async (bountyId: number) => {
      const contract = getWriteContract();
      const tx = await contract.claimExpiredBounty(bountyId);
      await tx.wait();
      return tx.hash;
    },
    [getWriteContract]
  );

  // ── Org write functions ─────────────────────────────────────────────────────

  const approveMerge = useCallback(
    async (bountyId: number) => {
      const contract = getWriteContract();
      const tx = await contract.approveMerge(bountyId);
      await tx.wait();
      return tx.hash;
    },
    [getWriteContract]
  );

  const rejectPR = useCallback(
    async (bountyId: number) => {
      const contract = getWriteContract();
      const tx = await contract.rejectPR(bountyId);
      await tx.wait();
      return tx.hash;
    },
    [getWriteContract]
  );

  const cancelBounty = useCallback(
    async (bountyId: number) => {
      const contract = getWriteContract();
      const tx = await contract.cancelBounty(bountyId);
      await tx.wait();
      return tx.hash;
    },
    [getWriteContract]
  );

  const increaseBounty = useCallback(
    async (bountyId: number, amountEth: string) => {
      const contract = getWriteContract();
      const tx = await contract.increaseBounty(bountyId, { value: ethers.parseEther(amountEth) });
      await tx.wait();
      return tx.hash;
    },
    [getWriteContract]
  );

  const fundRepo = useCallback(
    async (repoId: number, amountEth: string) => {
      const contract = getWriteContract();
      const tx = await contract.fundRepo(repoId, { value: ethers.parseEther(amountEth) });
      await tx.wait();
      return tx.hash;
    },
    [getWriteContract]
  );

  const withdrawRepoFunds = useCallback(
    async (repoId: number, amountEth: string) => {
      const contract = getWriteContract();
      const tx = await contract.withdrawRepoFunds(repoId, ethers.parseEther(amountEth));
      await tx.wait();
      return tx.hash;
    },
    [getWriteContract]
  );

  const updateRepoDeadlines = useCallback(
    async (repoId: number, easySeconds: number, mediumSeconds: number, hardSeconds: number) => {
      const contract = getWriteContract();
      const tx = await contract.updateDeadlines(repoId, easySeconds, mediumSeconds, hardSeconds);
      await tx.wait();
      return tx.hash;
    },
    [getWriteContract]
  );

  // ── Read functions ──────────────────────────────────────────────────────────

  const getRepoByUrl = useCallback(async (repoUrl: string): Promise<OnChainRepo | null> => {
    if (!CONTRACT_ADDRESS) return null;
    try {
      const repo = await getReadContract().getRepoByUrl(repoUrl);
      return repo as unknown as OnChainRepo;
    } catch { return null; }
  }, []);

  const getRepo = useCallback(async (repoId: number): Promise<OnChainRepo | null> => {
    if (!CONTRACT_ADDRESS) return null;
    try {
      const repo = await getReadContract().getRepo(repoId);
      return repo as unknown as OnChainRepo;
    } catch { return null; }
  }, []);

  const getOrgRepos = useCallback(async (orgAddress: string): Promise<OnChainRepo[]> => {
    if (!CONTRACT_ADDRESS || !orgAddress) return [];
    try {
      const contract = getReadContract();
      const ids: bigint[] = await contract.getOrgRepos(orgAddress);
      const results: OnChainRepo[] = [];
      for (const id of ids) {
        try {
          const r = await contract.getRepo(id);
          results.push(r as unknown as OnChainRepo);
        } catch { /* skip */ }
      }
      return results;
    } catch { return []; }
  }, []);

  const getAllBounties = useCallback(async (): Promise<OnChainBounty[]> => {
    if (!CONTRACT_ADDRESS) return [];
    try {
      const contract = getReadContract();
      const nextId = Number(await contract.nextBountyId());
      const results: OnChainBounty[] = [];
      const start = Math.max(1, nextId - 30);
      for (let i = start; i < nextId; i++) {
        try {
          results.push(mapRawBounty(await contract.getBounty(i)));
        } catch { /* skip */ }
      }
      return results.reverse();
    } catch { return []; }
  }, []);

  const getContributorBounties = useCallback(async (address: string): Promise<OnChainBounty[]> => {
    if (!CONTRACT_ADDRESS || !address) return [];
    try {
      const contract = getReadContract();
      const ids: bigint[] = await contract.getContributorBounties(address);
      const results: OnChainBounty[] = [];
      for (const id of ids) {
        try { results.push(mapRawBounty(await contract.getBounty(id))); } catch { /* skip */ }
      }
      return results;
    } catch { return []; }
  }, []);

  const getRepoBounties = useCallback(async (repoId: number): Promise<OnChainBounty[]> => {
    if (!CONTRACT_ADDRESS) return [];
    try {
      const contract = getReadContract();
      const ids: bigint[] = await contract.getRepoBounties(repoId);
      const results: OnChainBounty[] = [];
      for (const id of ids) {
        try { results.push(mapRawBounty(await contract.getBounty(id))); } catch { /* skip */ }
      }
      return results;
    } catch { return []; }
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const formatBountyStatus = (status: number) => STATUS_FROM_NUM[status] ?? "UNKNOWN";
  const formatSeverity = (severity: number) => SEVERITY_FROM_NUM[severity] ?? "LOW";

  return {
    isConnected,
    isCorrectChain,
    // contributor writes
    registerRepo,
    batchCreateBounties,
    takeBounty,
    submitPR,
    claimBounty,
    claimExpiredBounty,
    // org writes
    approveMerge,
    rejectPR,
    cancelBounty,
    increaseBounty,
    fundRepo,
    withdrawRepoFunds,
    updateRepoDeadlines,
    // reads
    getRepoByUrl,
    getRepo,
    getOrgRepos,
    getAllBounties,
    getContributorBounties,
    getRepoBounties,
    // utils
    formatBountyStatus,
    formatSeverity,
  };
}
