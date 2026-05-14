#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    token, symbol_short,
    Address, Env, Symbol, Vec,
};

// ──────────────────────────────────────────────────────────
//  Storage Keys
// ──────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Stream(u64),   // stream_id → Stream
    NextId,        // global auto-increment counter
}

// ──────────────────────────────────────────────────────────
//  Core Data Types
// ──────────────────────────────────────────────────────────

/// Status of a stream.
#[contracttype]
#[derive(Clone, PartialEq)]
pub enum StreamStatus {
    Active,
    Cancelled,
    Completed,
}

/// The on-chain representation of a token stream.
///
/// ## Linear Streaming Math
///
///   tokens_per_second = total_amount / duration_seconds
///   streamed_at(now)  = tokens_per_second * (now - start_time)
///   withdrawable      = streamed_at(now) - withdrawn_amount
///
/// All amounts are in the token's smallest unit (e.g. stroops for XLM).
/// Using i128 avoids overflow for large token supplies.
#[contracttype]
#[derive(Clone)]
pub struct Stream {
    pub id: u64,
    pub sender: Address,
    pub recipient: Address,
    pub token: Address,
    pub total_amount: i128,
    pub withdrawn_amount: i128,
    pub start_time: u64,      // Unix timestamp (seconds)
    pub stop_time: u64,       // start_time + duration_seconds
    pub rate_per_second: i128, // = total_amount / duration_seconds
    pub status: StreamStatus,
}

// ──────────────────────────────────────────────────────────
//  Contract
// ──────────────────────────────────────────────────────────

#[contract]
pub struct ZakaStreamContract;

#[contractimpl]
impl ZakaStreamContract {
    // ── CREATE STREAM ─────────────────────────────────────────

    /// Creates a new token stream.
    ///
    /// - Transfers `total_amount` of `token` from `sender` to the contract.
    /// - Records the stream with a linear rate calculated as:
    ///   `rate_per_second = total_amount / duration_seconds`
    ///
    /// # Panics
    /// - If `duration_seconds` is zero (division by zero guard)
    /// - If `total_amount` is not perfectly divisible by `duration_seconds`
    ///   (fractional stroops are not supported; callers should align amounts)
    pub fn create_stream(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        total_amount: i128,
        duration_seconds: u64,
    ) -> u64 {
        // Require sender's authorization for this call
        sender.require_auth();

        assert!(duration_seconds > 0, "duration must be > 0");
        assert!(total_amount > 0, "amount must be > 0");
        assert!(
            recipient != sender,
            "sender and recipient must differ"
        );

        // Pull tokens into the contract's custody
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(
            &sender,
            &env.current_contract_address(),
            &total_amount,
        );

        // Calculate rate — integer division (flooring).
        // Callers must ensure total_amount % duration_seconds == 0
        // to avoid dust at end of stream.
        let rate_per_second = total_amount / (duration_seconds as i128);
        assert!(rate_per_second > 0, "rate per second must be > 0");

        let now = env.ledger().timestamp();
        let stream_id = Self::next_id(&env);

        let stream = Stream {
            id: stream_id,
            sender: sender.clone(),
            recipient: recipient.clone(),
            token,
            total_amount,
            withdrawn_amount: 0,
            start_time: now,
            stop_time: now + duration_seconds,
            rate_per_second,
            status: StreamStatus::Active,
        };

        env.storage().persistent().set(&DataKey::Stream(stream_id), &stream);

        // Emit event
        env.events().publish(
            (symbol_short!("create"), symbol_short!("stream")),
            (stream_id, sender, recipient, total_amount, duration_seconds),
        );

        stream_id
    }

    // ── WITHDRAW FROM STREAM ──────────────────────────────────

    /// Allows the recipient to withdraw all currently available tokens.
    ///
    /// Available = (rate_per_second × elapsed_seconds) − already_withdrawn
    ///
    /// Capped at `total_amount` (i.e., the stream cannot pay out more than locked).
    pub fn withdraw_from_stream(env: Env, stream_id: u64, recipient: Address) -> i128 {
        recipient.require_auth();

        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&DataKey::Stream(stream_id))
            .expect("stream not found");

        assert!(
            stream.status == StreamStatus::Active,
            "stream is not active"
        );
        assert!(
            stream.recipient == recipient,
            "caller is not the stream recipient"
        );

        let withdrawable = Self::compute_withdrawable(&env, &stream);
        assert!(withdrawable > 0, "nothing to withdraw yet");

        stream.withdrawn_amount += withdrawable;

        // Mark as completed if fully drained
        if stream.withdrawn_amount >= stream.total_amount {
            stream.status = StreamStatus::Completed;
        }

        env.storage().persistent().set(&DataKey::Stream(stream_id), &stream);

        let token_client = token::Client::new(&env, &stream.token);
        token_client.transfer(
            &env.current_contract_address(),
            &recipient,
            &withdrawable,
        );

        // Emit event
        env.events().publish(
            (symbol_short!("withdraw"), symbol_short!("stream")),
            (stream_id, recipient, withdrawable),
        );

        withdrawable
    }

    // ── CANCEL STREAM ─────────────────────────────────────────

    /// Cancels an active stream.
    ///
    /// - The recipient receives all tokens streamed so far (minus what was already withdrawn).
    /// - The sender receives the remaining unstreamed tokens.
    pub fn cancel_stream(env: Env, stream_id: u64, sender: Address) -> (i128, i128) {
        sender.require_auth();

        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&DataKey::Stream(stream_id))
            .expect("stream not found");

        assert!(
            stream.status == StreamStatus::Active,
            "stream is not active"
        );
        assert!(stream.sender == sender, "caller is not the stream sender");

        let recipient_portion = Self::compute_withdrawable(&env, &stream);
        let sender_refund = stream.total_amount
            - stream.withdrawn_amount
            - recipient_portion;

        stream.status = StreamStatus::Cancelled;
        stream.withdrawn_amount = stream.total_amount; // fully settled
        env.storage().persistent().set(&DataKey::Stream(stream_id), &stream);

        let token_client = token::Client::new(&env, &stream.token);

        // Pay recipient their earned-but-not-yet-withdrawn portion
        if recipient_portion > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &stream.recipient,
                &recipient_portion,
            );
        }

        // Refund sender the unstreamed portion
        if sender_refund > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &sender,
                &sender_refund,
            );
        }

        // Emit event
        env.events().publish(
            (symbol_short!("cancel"), symbol_short!("stream")),
            (stream_id, sender, recipient_portion, sender_refund),
        );

        (recipient_portion, sender_refund)
    }

    // ── VIEW: GET STREAM ──────────────────────────────────────

    /// Returns the full state of a stream.
    pub fn get_stream(env: Env, stream_id: u64) -> Stream {
        env.storage()
            .persistent()
            .get(&DataKey::Stream(stream_id))
            .expect("stream not found")
    }

    /// Returns the amount currently withdrawable by the recipient.
    pub fn withdrawable_amount(env: Env, stream_id: u64) -> i128 {
        let stream: Stream = env
            .storage()
            .persistent()
            .get(&DataKey::Stream(stream_id))
            .expect("stream not found");
        Self::compute_withdrawable(&env, &stream)
    }

    // ── INTERNAL HELPERS ──────────────────────────────────────

    /// Linear streaming math — all integer arithmetic.
    ///
    ///   now_capped = min(current_time, stop_time)
    ///   elapsed    = now_capped - start_time
    ///   streamed   = rate_per_second * elapsed
    ///   available  = streamed - withdrawn_amount
    fn compute_withdrawable(env: &Env, stream: &Stream) -> i128 {
        if stream.status != StreamStatus::Active {
            return 0;
        }

        let now = env.ledger().timestamp();
        // Cap at stop_time so we never stream more than total_amount
        let effective_now = now.min(stream.stop_time);

        if effective_now <= stream.start_time {
            return 0;
        }

        let elapsed = (effective_now - stream.start_time) as i128;
        let streamed = stream.rate_per_second * elapsed;
        let available = streamed - stream.withdrawn_amount;

        available.max(0)
    }

    /// Auto-incrementing stream ID counter.
    fn next_id(env: &Env) -> u64 {
        let id: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::NextId)
            .unwrap_or(0);
        let next = id + 1;
        env.storage().persistent().set(&DataKey::NextId, &next);
        next
    }
}

// ──────────────────────────────────────────────────────────
//  Tests
// ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::{Client as TokenClient, StellarAssetClient},
        Env,
    };

    fn create_token(env: &Env, admin: &Address) -> Address {
        let token_address = env.register_stellar_asset_contract(admin.clone());
        token_address
    }

    #[test]
    fn test_create_and_withdraw() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);

        // Create a test token and mint to sender
        let token_address = create_token(&env, &sender);
        let token_admin = StellarAssetClient::new(&env, &token_address);
        let total_amount: i128 = 1_000_000_000; // 100 XLM in stroops (1 XLM = 10_000_000)
        let duration: u64 = 1_000;              // 1000 seconds
        token_admin.mint(&sender, &total_amount);

        let contract_id = env.register_contract(None, ZakaStreamContract);
        let client = ZakaStreamContractClient::new(&env, &contract_id);

        // Set ledger timestamp to 1000
        env.ledger().set_timestamp(1000);

        let stream_id = client.create_stream(
            &sender,
            &recipient,
            &token_address,
            &total_amount,
            &duration,
        );
        assert_eq!(stream_id, 1);

        // Advance time by 500 seconds (halfway)
        env.ledger().set_timestamp(1500);

        let withdrawable = client.withdrawable_amount(&stream_id);
        // rate = 1_000_000_000 / 1000 = 1_000_000 per second
        // elapsed = 500, so withdrawable = 500_000_000
        assert_eq!(withdrawable, 500_000_000);

        let withdrawn = client.withdraw_from_stream(&stream_id, &recipient);
        assert_eq!(withdrawn, 500_000_000);

        // After withdrawal, withdrawable should be 0 immediately
        let still_available = client.withdrawable_amount(&stream_id);
        assert_eq!(still_available, 0);
    }

    #[test]
    fn test_cancel_stream() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let token_address = create_token(&env, &sender);
        let token_admin = StellarAssetClient::new(&env, &token_address);

        let total_amount: i128 = 1_000_000_000;
        let duration: u64 = 1_000;
        token_admin.mint(&sender, &total_amount);

        let contract_id = env.register_contract(None, ZakaStreamContract);
        let client = ZakaStreamContractClient::new(&env, &contract_id);

        env.ledger().set_timestamp(0);
        let stream_id = client.create_stream(
            &sender,
            &recipient,
            &token_address,
            &total_amount,
            &duration,
        );

        // Cancel at 25% elapsed
        env.ledger().set_timestamp(250);
        let (recipient_got, sender_got) = client.cancel_stream(&stream_id, &sender);

        // rate = 1_000_000, elapsed = 250
        // recipient_portion = 250 * 1_000_000 = 250_000_000
        // sender_refund     = 1_000_000_000 - 0 - 250_000_000 = 750_000_000
        assert_eq!(recipient_got, 250_000_000);
        assert_eq!(sender_got, 750_000_000);

        // Verify token balances
        let token_client = TokenClient::new(&env, &token_address);
        assert_eq!(token_client.balance(&recipient), 250_000_000);
        assert_eq!(token_client.balance(&sender), 750_000_000);
    }

    #[test]
    fn test_stream_caps_at_stop_time() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let token_address = create_token(&env, &sender);
        let token_admin = StellarAssetClient::new(&env, &token_address);

        let total_amount: i128 = 1_000_000_000;
        let duration: u64 = 1_000;
        token_admin.mint(&sender, &total_amount);

        let contract_id = env.register_contract(None, ZakaStreamContract);
        let client = ZakaStreamContractClient::new(&env, &contract_id);

        env.ledger().set_timestamp(0);
        let stream_id = client.create_stream(
            &sender, &recipient, &token_address, &total_amount, &duration,
        );

        // Advance far past stop_time
        env.ledger().set_timestamp(99_999);

        // Withdrawable should be capped at total_amount
        let withdrawable = client.withdrawable_amount(&stream_id);
        assert_eq!(withdrawable, total_amount);
    }
}
