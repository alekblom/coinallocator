module coin_allocator::split {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::event;

    // ===== Error codes =====
    const ESharesNotFullyAllocated: u64 = 0;
    const ETooManyRecipients: u64 = 1;
    const ENoRecipients: u64 = 2;
    const EInvalidShareBps: u64 = 3;
    const EDuplicateRecipient: u64 = 4;
    const ERecipientNotFound: u64 = 5;
    const ENothingToClaim: u64 = 6;
    const EUnauthorized: u64 = 7;
    const EEmptyName: u64 = 8;
    const EVaultNotEmpty: u64 = 9;

    const MAX_RECIPIENTS: u64 = 10;
    const BPS_TOTAL: u64 = 10000;

    // ===== Objects =====

    public struct Recipient has store, copy, drop {
        wallet: address,
        share_bps: u64,
        claimed: u64,
    }

    public struct Split has key {
        id: UID,
        creator: address,
        name: vector<u8>,
        recipients: vector<Recipient>,
        vault: Balance<SUI>,
        total_received: u64,
        created_at: u64,
    }

    // ===== Events =====

    public struct SplitCreated has copy, drop {
        split_id: address,
        creator: address,
        name: vector<u8>,
    }

    // ===== Entry functions =====

    /// Create a new fund-splitting contract.
    /// `wallets` and `shares` must be equal length; shares must sum to 10000 bps.
    entry fun create_split(
        name: vector<u8>,
        wallets: vector<address>,
        shares: vector<u64>,
        ctx: &mut TxContext,
    ) {
        let len = vector::length(&wallets);
        assert!(vector::length(&name) > 0, EEmptyName);
        assert!(len > 0, ENoRecipients);
        assert!(len <= MAX_RECIPIENTS, ETooManyRecipients);
        assert!(len == vector::length(&shares), ENoRecipients);

        // Build recipients and validate
        let mut recipients = vector::empty<Recipient>();
        let mut total_bps: u64 = 0;
        let mut i: u64 = 0;
        while (i < len) {
            let share = *vector::borrow(&shares, i);
            assert!(share > 0 && share <= BPS_TOTAL, EInvalidShareBps);

            let wallet = *vector::borrow(&wallets, i);

            // Check for duplicates
            let mut j: u64 = 0;
            while (j < i) {
                let existing = vector::borrow(&recipients, j);
                assert!(existing.wallet != wallet, EDuplicateRecipient);
                j = j + 1;
            };

            vector::push_back(&mut recipients, Recipient {
                wallet,
                share_bps: share,
                claimed: 0,
            });
            total_bps = total_bps + share;
            i = i + 1;
        };

        assert!(total_bps == BPS_TOTAL, ESharesNotFullyAllocated);

        let creator = tx_context::sender(ctx);
        let split = Split {
            id: object::new(ctx),
            creator,
            name: name,
            recipients,
            vault: balance::zero<SUI>(),
            total_received: 0,
            created_at: tx_context::epoch(ctx),
        };

        event::emit(SplitCreated {
            split_id: object::uid_to_address(&split.id),
            creator,
            name: split.name,
        });

        transfer::share_object(split);
    }

    /// Deposit SUI into the split vault.
    entry fun deposit(
        split: &mut Split,
        payment: Coin<SUI>,
    ) {
        let amount = coin::value(&payment);
        split.total_received = split.total_received + amount;
        balance::join(&mut split.vault, coin::into_balance(payment));
    }

    /// Distribute all vault funds to recipients proportionally (push model).
    entry fun distribute(
        split: &mut Split,
        ctx: &mut TxContext,
    ) {
        let vault_amount = balance::value(&split.vault);
        assert!(vault_amount > 0, ENothingToClaim);

        let len = vector::length(&split.recipients);
        let mut distributed: u64 = 0;
        let mut i: u64 = 0;

        while (i < len) {
            let recipient = vector::borrow_mut(&mut split.recipients, i);
            let share = if (i == len - 1) {
                // Last recipient gets remainder to avoid rounding dust
                vault_amount - distributed
            } else {
                (vault_amount * recipient.share_bps) / BPS_TOTAL
            };

            if (share > 0) {
                let coin = coin::from_balance(balance::split(&mut split.vault, share), ctx);
                transfer::public_transfer(coin, recipient.wallet);
                recipient.claimed = recipient.claimed + share;
                distributed = distributed + share;
            };

            i = i + 1;
        };
    }

    /// Claim sender's share from the vault (pull model).
    entry fun claim(
        split: &mut Split,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let vault_amount = balance::value(&split.vault);
        let total_ever = split.total_received;

        let len = vector::length(&split.recipients);
        let mut i: u64 = 0;
        let mut found = false;

        while (i < len) {
            let recipient = vector::borrow_mut(&mut split.recipients, i);
            if (recipient.wallet == sender) {
                found = true;
                let entitlement = (total_ever * recipient.share_bps) / BPS_TOTAL;
                let claimable = if (entitlement > recipient.claimed) {
                    entitlement - recipient.claimed
                } else {
                    0
                };
                assert!(claimable > 0, ENothingToClaim);
                // Cap at available vault balance
                let actual = if (claimable > vault_amount) { vault_amount } else { claimable };
                let coin = coin::from_balance(balance::split(&mut split.vault, actual), ctx);
                transfer::public_transfer(coin, sender);
                recipient.claimed = recipient.claimed + actual;
                break
            };
            i = i + 1;
        };

        assert!(found, ERecipientNotFound);
    }

    /// Close the split. Creator only, vault must be empty.
    entry fun close_split(
        split: Split,
        ctx: &TxContext,
    ) {
        assert!(tx_context::sender(ctx) == split.creator, EUnauthorized);
        assert!(balance::value(&split.vault) == 0, EVaultNotEmpty);

        let Split { id, creator: _, name: _, recipients: _, vault, total_received: _, created_at: _ } = split;
        balance::destroy_zero(vault);
        object::delete(id);
    }

    // ===== View functions =====

    public fun get_creator(split: &Split): address { split.creator }
    public fun get_name(split: &Split): vector<u8> { split.name }
    public fun get_vault_balance(split: &Split): u64 { balance::value(&split.vault) }
    public fun get_total_received(split: &Split): u64 { split.total_received }
    public fun get_recipient_count(split: &Split): u64 { vector::length(&split.recipients) }

    // ===== Tests =====

    #[test_only]
    use sui::test_scenario;

    #[test]
    fun test_create_split() {
        let creator = @0xA;
        let mut scenario = test_scenario::begin(creator);

        // Create split
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let wallets = vector[@0xB, @0xC];
            let shares = vector[6000, 4000];
            create_split(b"Test Split", wallets, shares, ctx);
        };

        // Verify split exists as shared object
        test_scenario::next_tx(&mut scenario, creator);
        {
            let split = test_scenario::take_shared<Split>(&scenario);
            assert!(get_creator(&split) == creator);
            assert!(get_name(&split) == b"Test Split");
            assert!(get_recipient_count(&split) == 2);
            assert!(get_vault_balance(&split) == 0);
            test_scenario::return_shared(split);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_deposit_and_distribute() {
        let creator = @0xA;
        let depositor = @0xD;
        let mut scenario = test_scenario::begin(creator);

        // Create split: 60% to B, 40% to C
        {
            let ctx = test_scenario::ctx(&mut scenario);
            create_split(b"Split", vector[@0xB, @0xC], vector[6000, 4000], ctx);
        };

        // Deposit 1 SUI (1_000_000_000 MIST)
        test_scenario::next_tx(&mut scenario, depositor);
        {
            let mut split = test_scenario::take_shared<Split>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let coin = coin::mint_for_testing<SUI>(1_000_000_000, ctx);
            deposit(&mut split, coin);
            assert!(get_vault_balance(&split) == 1_000_000_000);
            test_scenario::return_shared(split);
        };

        // Distribute
        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut split = test_scenario::take_shared<Split>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            distribute(&mut split, ctx);
            assert!(get_vault_balance(&split) == 0);
            test_scenario::return_shared(split);
        };

        // Verify B received 60%
        test_scenario::next_tx(&mut scenario, @0xB);
        {
            let coin = test_scenario::take_from_address<Coin<SUI>>(&scenario, @0xB);
            assert!(coin::value(&coin) == 600_000_000);
            test_scenario::return_to_address(@0xB, coin);
        };

        // Verify C received 40%
        test_scenario::next_tx(&mut scenario, @0xC);
        {
            let coin = test_scenario::take_from_address<Coin<SUI>>(&scenario, @0xC);
            assert!(coin::value(&coin) == 400_000_000);
            test_scenario::return_to_address(@0xC, coin);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_claim() {
        let creator = @0xA;
        let mut scenario = test_scenario::begin(creator);

        // Create split
        {
            let ctx = test_scenario::ctx(&mut scenario);
            create_split(b"Split", vector[@0xB, @0xC], vector[6000, 4000], ctx);
        };

        // Deposit
        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut split = test_scenario::take_shared<Split>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let coin = coin::mint_for_testing<SUI>(1_000_000_000, ctx);
            deposit(&mut split, coin);
            test_scenario::return_shared(split);
        };

        // B claims their 60%
        test_scenario::next_tx(&mut scenario, @0xB);
        {
            let mut split = test_scenario::take_shared<Split>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            claim(&mut split, ctx);
            test_scenario::return_shared(split);
        };

        // Verify B got 60%
        test_scenario::next_tx(&mut scenario, @0xB);
        {
            let coin = test_scenario::take_from_address<Coin<SUI>>(&scenario, @0xB);
            assert!(coin::value(&coin) == 600_000_000);
            test_scenario::return_to_address(@0xB, coin);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ESharesNotFullyAllocated)]
    fun test_shares_not_100_percent() {
        let creator = @0xA;
        let mut scenario = test_scenario::begin(creator);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            create_split(b"Bad", vector[@0xB, @0xC], vector[5000, 3000], ctx);
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EDuplicateRecipient)]
    fun test_duplicate_recipients() {
        let creator = @0xA;
        let mut scenario = test_scenario::begin(creator);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            create_split(b"Dup", vector[@0xB, @0xB], vector[5000, 5000], ctx);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_close_split() {
        let creator = @0xA;
        let mut scenario = test_scenario::begin(creator);

        {
            let ctx = test_scenario::ctx(&mut scenario);
            create_split(b"Close", vector[@0xB, @0xC], vector[6000, 4000], ctx);
        };

        test_scenario::next_tx(&mut scenario, creator);
        {
            let split = test_scenario::take_shared<Split>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            close_split(split, ctx);
        };

        test_scenario::end(scenario);
    }
}
