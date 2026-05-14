/**
 * lib/freighter.ts — Freighter wallet integration helpers.
 *
 * Freighter is a Stellar browser extension wallet.
 * Docs: https://docs.freighter.app
 *
 * NOTE: @stellar/freighter-api v2 changed the return types vs v1.
 * isConnected() → Promise<{ isConnected: boolean; error: string }>
 * requestAccess() → Promise<{ publicKey: string; error: string }>
 * getPublicKey() → Promise<{ publicKey: string; error: string }>
 * signTransaction() → Promise<{ signedTxXdr: string; error: string }>
 * getNetworkDetails() → Promise<{ network, networkPassphrase, ...; error }>
 */

import {
  isConnected,
  getPublicKey,
  signTransaction,
  requestAccess,
  getNetworkDetails,
} from "@stellar/freighter-api";

export type FreighterError = {
  code: "NOT_INSTALLED" | "USER_REJECTED" | "WRONG_NETWORK" | "UNKNOWN";
  message: string;
};

// ── Connection ────────────────────────────────────────────

/**
 * Checks if Freighter is installed in the browser.
 */
export async function checkFreighterInstalled(): Promise<boolean> {
  try {
    const result = await isConnected();
    // v2 API: returns { isConnected: boolean; error: string }
    if (typeof result === "object" && result !== null && "isConnected" in result) {
      return (result as { isConnected: boolean }).isConnected;
    }
    // Fallback: some builds return a plain boolean
    return Boolean(result);
  } catch {
    return false;
  }
}

/**
 * Requests access to the user's Freighter wallet.
 * Opens the Freighter extension popup if needed.
 *
 * @returns The user's public key (G... address) or throws FreighterError
 */
export async function connectFreighter(): Promise<string> {
  const installed = await checkFreighterInstalled();
  if (!installed) {
    throw {
      code: "NOT_INSTALLED",
      message:
        "Freighter wallet is not installed. Visit https://freighter.app to install it.",
    } satisfies FreighterError;
  }

  try {
    const accessResult = await requestAccess();
    // v2: { publicKey: string; error: string }
    const accessObj = accessResult as unknown as { publicKey?: string; error?: string };
    if (accessObj.error) {
      throw new Error(accessObj.error);
    }
    if (accessObj.publicKey) return accessObj.publicKey;

    // Fallback: try getPublicKey directly
    const pkResult = await getPublicKey();
    const pkObj = pkResult as unknown as { publicKey?: string; error?: string };
    if (pkObj.error) throw new Error(pkObj.error);
    if (pkObj.publicKey) return pkObj.publicKey;

    throw new Error("Could not retrieve public key from Freighter");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw {
      code: "USER_REJECTED",
      message: `Freighter error: ${msg}`,
    } satisfies FreighterError;
  }
}

/**
 * Returns the current network the user is connected to in Freighter.
 */
export async function getFreighterNetwork(): Promise<{
  network: string;
  networkPassphrase: string;
}> {
  try {
    const details = await getNetworkDetails();
    const obj = details as unknown as {
      network?: string;
      networkPassphrase?: string;
      error?: string;
    };
    if (obj.error) throw new Error(obj.error);
    return {
      network: obj.network ?? "TESTNET",
      networkPassphrase:
        obj.networkPassphrase ??
        "Test SDF Network ; September 2015",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw {
      code: "UNKNOWN",
      message: `Failed to get network: ${msg}`,
    } satisfies FreighterError;
  }
}

// ── Transaction Signing ───────────────────────────────────

/**
 * Signs an XDR-encoded transaction with Freighter.
 *
 * @param xdrStr - The base64-encoded transaction XDR to sign
 * @param networkPassphrase - The Stellar network passphrase
 * @returns The signed transaction XDR
 */
export async function signWithFreighter(
  xdrStr: string,
  networkPassphrase: string
): Promise<string> {
  try {
    const result = await signTransaction(xdrStr, { networkPassphrase });
    const obj = result as unknown as { signedTxXdr?: string; error?: string };
    if (obj.error) throw new Error(obj.error);
    if (obj.signedTxXdr) return obj.signedTxXdr;
    // Some versions return the XDR as a plain string
    if (typeof result === "string") return result;
    throw new Error("No signed XDR returned");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw {
      code: "USER_REJECTED",
      message: `Transaction signing rejected: ${msg}`,
    } satisfies FreighterError;
  }
}
