/**
 * lib/contract.ts — Soroban contract invocation helpers.
 *
 * Builds, simulates, and submits Soroban transactions for:
 *   - create_stream
 *   - withdraw_from_stream
 *   - cancel_stream
 */

import {
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { signWithFreighter, getFreighterNetwork } from "./freighter";

// ── Config ────────────────────────────────────────────────

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  "https://soroban-testnet.stellar.org";

const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

// ── Types ─────────────────────────────────────────────────

export interface CreateStreamParams {
  senderPublicKey: string;
  recipientAddress: string;
  tokenAddress: string;
  totalAmount: bigint;      // in token's smallest unit
  durationSeconds: bigint;
}

export interface StreamData {
  id: bigint;
  sender: string;
  recipient: string;
  token: string;
  totalAmount: bigint;
  withdrawnAmount: bigint;
  startTime: bigint;
  stopTime: bigint;
  ratePerSecond: bigint;
  status: "Active" | "Cancelled" | "Completed";
}

// ── Helpers ───────────────────────────────────────────────

async function buildAndSubmit(
  sourcePublicKey: string,
  contractMethod: string,
  args: xdr.ScVal[]
): Promise<xdr.ScVal> {
  const { networkPassphrase } = await getFreighterNetwork();
  const account = await server.getAccount(sourcePublicKey);

  const contract = new Contract(CONTRACT_ID);
  const txBuilder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call(contractMethod, ...args))
    .setTimeout(60);

  const tx = txBuilder.build();

  // Simulate to get footprint and resource fees
  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();

  // Sign with Freighter
  const signedXdr = await signWithFreighter(
    preparedTx.toXDR(),
    networkPassphrase
  );

  // Submit
  const submitResult = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, networkPassphrase)
  );

  if (submitResult.status === "ERROR") {
    throw new Error(`Submission failed: ${submitResult.errorResult?.toXDR()}`);
  }

  // Poll for completion
  let getResult = await server.getTransaction(submitResult.hash);
  let attempts = 0;
  while (
    getResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND &&
    attempts < 15
  ) {
    await new Promise((r) => setTimeout(r, 2000));
    getResult = await server.getTransaction(submitResult.hash);
    attempts++;
  }

  if (getResult.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction failed with status: ${getResult.status}`);
  }

  return getResult.returnValue ?? xdr.ScVal.scvVoid();
}

// ── Contract Methods ──────────────────────────────────────

/**
 * Creates a new token stream on-chain.
 * @returns The new stream ID (u64)
 */
export async function createStream(
  params: CreateStreamParams
): Promise<bigint> {
  const args: xdr.ScVal[] = [
    new Address(params.senderPublicKey).toScVal(),
    new Address(params.recipientAddress).toScVal(),
    new Address(params.tokenAddress).toScVal(),
    nativeToScVal(params.totalAmount, { type: "i128" }),
    nativeToScVal(params.durationSeconds, { type: "u64" }),
  ];

  const result = await buildAndSubmit(
    params.senderPublicKey,
    "create_stream",
    args
  );
  return scValToNative(result) as bigint;
}

/**
 * Withdraws all available tokens from a stream to the recipient.
 * @returns The amount withdrawn (i128)
 */
export async function withdrawFromStream(
  recipientPublicKey: string,
  streamId: bigint
): Promise<bigint> {
  const args: xdr.ScVal[] = [
    nativeToScVal(streamId, { type: "u64" }),
    new Address(recipientPublicKey).toScVal(),
  ];

  const result = await buildAndSubmit(
    recipientPublicKey,
    "withdraw_from_stream",
    args
  );
  return scValToNative(result) as bigint;
}

/**
 * Cancels a stream. Sender gets unstreamed tokens; recipient gets earned portion.
 */
export async function cancelStream(
  senderPublicKey: string,
  streamId: bigint
): Promise<{ recipientPortion: bigint; senderRefund: bigint }> {
  const args: xdr.ScVal[] = [
    nativeToScVal(streamId, { type: "u64" }),
    new Address(senderPublicKey).toScVal(),
  ];

  const result = await buildAndSubmit(senderPublicKey, "cancel_stream", args);
  const [recipientPortion, senderRefund] = scValToNative(result) as [
    bigint,
    bigint
  ];
  return { recipientPortion, senderRefund };
}

/**
 * Reads the current withdrawable amount for a stream (view call, no fee).
 */
export async function getWithdrawableAmount(streamId: bigint): Promise<bigint> {
  const contract = new Contract(CONTRACT_ID);
  const { networkPassphrase } = await getFreighterNetwork();

  const account = await server.getAccount(
    "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN" // fee-free sim account
  );

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "withdrawable_amount",
        nativeToScVal(streamId, { type: "u64" })
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) return 0n;

  const returnVal = (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse)
    .result?.retval;
  if (!returnVal) return 0n;

  return scValToNative(returnVal) as bigint;
}

// ── Local Math (for UI display, no RPC needed) ─────────────

/**
 * Computes real-time withdrawable balance locally using the linear formula.
 * Identical to the Rust contract logic.
 */
export function computeLocalWithdrawable(stream: {
  ratePerSecond: bigint;
  startTime: bigint;
  stopTime: bigint;
  withdrawnAmount: bigint;
  status: string;
}): bigint {
  if (stream.status !== "Active") return 0n;

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const effectiveNow =
    nowSec < stream.stopTime ? nowSec : stream.stopTime;

  if (effectiveNow <= stream.startTime) return 0n;

  const elapsed = effectiveNow - stream.startTime;
  const streamed = stream.ratePerSecond * elapsed;
  const withdrawable = streamed - stream.withdrawnAmount;

  return withdrawable > 0n ? withdrawable : 0n;
}
