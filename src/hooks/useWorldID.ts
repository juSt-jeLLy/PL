import { useState } from "react";
import { IDKit, deviceLegacy } from "@worldcoin/idkit-core";

const APP_ID = "app_b52cbede146e3f23a5dc57bdb12a630c"; 
const ACTION = "verify";           
const SIGNAL = "";                    
const API_BASE = import.meta.env.VITE_BACKEND_URL?.trim()?.replace(/\/$/, "") || "";

type VerifyStatus = "idle" | "loading" | "waiting" | "verifying" | "success" | "error";

const STORAGE_KEY_VERIFIED_RESULT = "mergex:worldid_verified_result";

function safeLoadVerifiedResult(): object | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VERIFIED_RESULT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function useWorldID() {
  const [result, setResult] = useState<object | null>(() => safeLoadVerifiedResult());
  const [status, setStatus] = useState<VerifyStatus>(() => (safeLoadVerifiedResult() ? "success" : "idle"));
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startVerification = async () => {
    setStatus("loading");
    setError(null);
    setConnectUrl(null);
    setResult(null);

    try {
      // Step 1: Get RP signature from backend
      const rpSig = await fetch(`${API_BASE}/api/rp-signature`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: ACTION }),
      }).then((r) => r.json());

      if (rpSig.error) throw new Error(rpSig.error);

      // Step 2: Build IDKit request
      const request = await IDKit.request({
        app_id: APP_ID,
        action: ACTION,
        rp_context: {
          rp_id: "rp_698536d3ec4ce424", // from Developer Portal
          nonce: rpSig.nonce,
          created_at: rpSig.created_at,
          expires_at: rpSig.expires_at,
          signature: rpSig.sig,
        },
        allow_legacy_proofs: true,
        environment: "production", // swap to "production" when live
      }).preset(deviceLegacy({ signal: SIGNAL }));

      // Step 3: Show connect URL to user (QR / deep link to World App)
      setConnectUrl(request.connectorURI);
      setStatus("waiting");

      // Step 4: Poll until user completes on mobile
      const idkitResponse = await request.pollUntilCompletion();
      setStatus("verifying");

      // Step 5: Verify proof on backend
      const verifyRes = await fetch(`${API_BASE}/api/verify-proof`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idkitResponse, action:ACTION }),
      }).then((r) => r.json());

      if (!verifyRes.success) {
        throw new Error(verifyRes?.verifyRes?.detail || "Proof verification failed");
      }

      setResult(verifyRes);
      setStatus("success");
      try {
        localStorage.setItem(STORAGE_KEY_VERIFIED_RESULT, JSON.stringify(verifyRes));
      } catch {
        /* ignore storage failures */
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  };

  const reset = () => {
    setStatus("idle");
    setConnectUrl(null);
    setResult(null);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY_VERIFIED_RESULT);
    } catch {
      /* ignore storage failures */
    }
  };

  return { status, connectUrl, result, error, startVerification, reset };
}
