# PR Review Report

## Summary

- **PR:** [VenusProtocol/vips#722](https://github.com/VenusProtocol/vips/pull/722)
- **Title:** `fix(vip-framework): enforce propose() gas cap against the real proposer-Safe execTransaction`
- **Branch:** `fix/vip-framework-propose-gas-cap-multisig` → `feat/VPD-1168`
- **Files changed:** `src/vip-framework/index.ts` (+111 / -27)
- **Type:** General code review (governance test-framework change; not a VIP/parameter change)
- **Verdict:** ✅ **LGTM (with minor non-blocking observations)**

The fix is well-reasoned and correct. It replaces a false-negative gas check (which measured the gas a *direct EOA* `propose()` **consumes**) with a measurement of the **required gas limit** of the real on-chain submission path (proposer Gnosis Safe `execTransaction(GOVERNOR_PROXY, proposeCalldata)`), via `estimateGas`. This correctly folds in the Safe wrapper overhead and EIP-150 63/64 forwarding reserves. The core technical claims were independently verified on-chain and against the Gnosis Safe spec.

---

## Checklist

| #   | Item | Status | Verification Method | Evidence |
| --- | ---- | ------ | ------------------- | -------- |
| 1   | EIP-150 analysis: consumed gas undercounts required limit across proxy hops | ✅ PASS | Spec/EIP-150 reasoning + PR empirical data | Call chain SafeProxy→SafeSingleton→GovernorProxy→GovernorImpl. Each `CALL` forwards ≤63/64 of available gas, so the *limit* must exceed consumption. PR data: VIP-634 P1 consumes 15.35M (91.5%) yet needs a 16.42M (97.86%) limit — a real ~1.07M gap that the old `gasUsed` check missed. The closed-form `G×(64/63)^k` is an approximation (see Issue #2), but `estimateGas` on the real path is exact — the right approach. |
| 2   | `SAFE_THRESHOLD_SLOT = "0x4"` is the correct Gnosis Safe threshold slot | ✅ PASS | **On-chain storage read** | `eth_getStorageAt(0x5176…59cb, slot 0x4)` → `0x…0003`, and `getThreshold()` → `0x…0003`. Slot 4 value **exactly equals** the reported threshold. Matches Safe v1.3.0 layout (0=nonce, 1=signedMessages, 2=approvedHashes, 3=masterCopy(deprecated), **4=threshold**, 5=ownerCount). |
| 3   | v=1 "pre-validated" signature format `r=owner ‖ s=0 ‖ v=1` is correct | ✅ PASS | Gnosis Safe `checkSignatures` spec + code inspection | For `v==1`, Safe computes `currentOwner = address(uint160(uint256(r)))` and requires `msg.sender == currentOwner` (no ecrecover). Encoding `"0x"+owner.padStart(64,'0')+"0"*64+"01"` = 32-byte r(owner) ‖ 32-byte s(0) ‖ 1-byte v(01). `initMainnetUser(owner)` returns an impersonated signer for `owner`, so `safe.connect(executor)` sets `msg.sender == owner`. Check satisfied. Single sig + threshold=1 ⇒ no signature-ordering constraint. |
| 4   | `isSafe()` is called twice — race/inconsistency? | ✅ PASS (minor inefficiency) | Code inspection | Called in the `if (await isSafe(...))` guard and again in `enforce: !(await isSafe(...))`. `isSafe` is a deterministic view call (`getThreshold`); threshold being lowered 3→1 between calls does not change the result (still returns ⇒ true). **No correctness bug.** Two redundant RPC calls — could cache to one `const`. |
| 5   | Threshold lowering via `hardhat_setStorageAt` — restored? corrupts later steps? | ⚠️ OBSERVATION | Code/lifecycle inspection | Threshold is set to 1 and **never restored**. Harmless here: the rest of the lifecycle (`propose` via direct impersonation, `queue`/`execute` via timelock) never routes through the proposer Safe again, so no downstream step reads its threshold. The estimate runs *before* the direct `propose`, so ordering is correct. Still, it leaves a persistent fork mutation; restoring the original slot value would be cleaner/defensive. |
| 6   | `GOVERNOR_PROXY` hardcoding in `estimateProposeViaMultisig` | ✅ PASS | Code inspection (line 189–192) | `governorProxy = ethers.getContractAt(…, GOVERNOR_PROXY)`, and `proposeCalldata = governorProxy.populateTransaction.propose(...)`. The estimate calls `execTransaction(GOVERNOR_PROXY, …, proposeCalldata, …)` — `to` and the calldata target the **same** module-level `GOVERNOR_PROXY`. No mismatch. `proposeArgs` only carries the VIP's *command* targets (executed later by the timelock), not a different governor. |
| 7   | Gas delta: 1-of-1 v=1 estimate vs real 3-of-5 ECDSA sigs | ⚠️ OBSERVATION | On-chain (3-of-5) + Safe cost model | Proposer is a **3-of-5** Safe (`getThreshold`→3, `getOwners`→5). Real submission verifies 3 ECDSA sigs (3× ecrecover ≈ 3k each) + 2 extra 65-byte sigs of calldata (~2k). The v=1 estimate skips ecrecover entirely, so it **understates** real cost by ~10–15k gas — i.e. it is *not* a strict upper bound. Immaterial vs propose's ~16M and far inside the 3% (~503k) warning band, but worth noting: residual false-negative window shrinks from ~1.1M (the bug) to ~10–15k, not zero. |
| 8   | Automated tests covering new functions | ⚠️ ISSUE (no new tests) | Repo search | No `*.test.ts`/`*.spec.ts` under `src/`; no test references `estimateProposeViaMultisig`/`isSafe`. The framework is exercised **indirectly** by every `simulations/**` run (each calls `testVip → reportTxGas`). No dedicated unit test was added for the new helpers. Consistent with repo convention (no framework unit tests exist), but the new gas-cap logic and Safe-storage manipulation are untested in isolation. |

---

## Issues Found

| #   | Severity | Location | Description | Evidence |
| --- | -------- | -------- | ----------- | -------- |
| 1 | Low / nit | `estimateProposeViaMultisig` (`hardhat_setStorageAt`) | Safe `threshold` lowered to 1 on the fork and never restored — a persistent fork mutation. Harmless for the current lifecycle (no later step reads the proposer Safe threshold) but not defensive against future test steps. | Checklist #5 |
| 2 | Low / informational | `estimateProposeViaMultisig` (v=1 single sig) | The 1-of-1 v=1 estimate **understates** the real 3-of-5 cost by ~10–15k gas (skipped ecrecovers + 2 fewer sigs of calldata). So `requiredGasLimit` is a slight *under*-estimate, not a conservative bound. Acceptable: dwarfed by the ~1.1M overhead it now captures and well inside the 3% warning band. PR text ("a few thousand gas") is directionally right. | Checklist #7 |
| 3 | Low | `isSafe(DEFAULT_PROPOSER_ADDRESS)` called twice | Redundant RPC round-trip; cache into a single `const isProposerSafe = await isSafe(...)` and reuse. No correctness impact. | Checklist #4 |
| 4 | Low | No dedicated unit tests | New helpers (`estimateProposeViaMultisig`, `isSafe`, near-cap warning, `metric` labelling) have no isolated tests; only indirect coverage via existing simulations. | Checklist #8 |

**No blocking issues.** All findings are Low severity / nits. The fix is correct and materially improves the cap check.

---

## Verified Items

| Claim | Result | Proof |
| ----- | ------ | ----- |
| Proposer is a Gnosis Safe | ✅ | `getThreshold()` on `0x5176…59cb` → 3; `getOwners()` → 5 owners (3-of-5) |
| `SAFE_THRESHOLD_SLOT = 0x4` correct | ✅ | `getStorageAt(slot 0x4)` == `getThreshold()` == 3 |
| v=1 sig encoding correct | ✅ | Matches Safe `checkSignatures` v==1 branch (`msg.sender == r-as-address`); executor impersonates `owner` |
| `GOVERNOR_PROXY` target consistent | ✅ | `governorProxy` bound to `GOVERNOR_PROXY` (index.ts:189-192); calldata + `to` use same address |
| Required limit > consumed gas | ✅ | EIP-150 63/64 across 3+ proxy hops; PR data shows ~1.07M real gap (VIP-634 P1) |
| Estimate runs before live propose | ✅ | `if (isSafe) { estimate… }` precedes `governorProxy.connect(proposer).propose(...)` |
| `queue`/`execute` still measure consumed gas | ✅ | Unchanged; correct since those aren't multisig-wrapped on-chain |
| Non-Safe proposer fallback | ✅ | Direct-propose enforces cap only when `!isSafe(...)` |

---

## Test Execution Scripts

The change is to the simulation framework itself; it is validated by running any VIP simulation and observing the new `requiredGasLimit=` line + near-cap warning. The PR cites BSC-mainnet archival forks of VIP-634 / VIP-635.

```bash
# Step 1: Clone the vips repo and check out PR #722
cd /tmp && rm -rf vips-pr722 && \
gh repo clone VenusProtocol/vips vips-pr722 -- --depth 50 && \
cd vips-pr722 && \
git fetch origin pull/722/head:pr-722 && \
git checkout pr-722 && \
yarn install

# Step 2: Provide an archive node (required for forking)
export ARCHIVE_NODE_bscmainnet="https://<your-bsc-archive-rpc>"

# Step 3a: Run a heavy BSC VIP simulation and confirm the new propose-cap line.
#          Expect a log line of the form:
#   [gas] <desc> propose() via proposer-Safe execTransaction requiredGasLimit=<n> (<pct>% of bscmainnet per-tx cap 16780000)
#          and, for a near-cap VIP (>97%), a "[gas] WARNING: ... within 3% of the per-tx cap" line.
npx hardhat test simulations/vip-635/bscmainnet.ts --fork bscmainnet

# Step 3b: Sanity-check the on-chain facts this review relied on (foundry `cast`):
#   - proposer Safe threshold (expect 3) and that storage slot 4 holds it:
cast call   0x5176671de05380379399b669ed276feec99d59cb "getThreshold()(uint256)" --rpc-url "$ARCHIVE_NODE_bscmainnet"
cast storage 0x5176671de05380379399b669ed276feec99d59cb 4                       --rpc-url "$ARCHIVE_NODE_bscmainnet"
#   - owners (expect 5):
cast call   0x5176671de05380379399b669ed276feec99d59cb "getOwners()(address[])"  --rpc-url "$ARCHIVE_NODE_bscmainnet"
```

### Suggested enhancement test (optional, for the PR author)

To lock in the regression the PR describes (a VIP that passes the old `gasUsed` check but exceeds the cap under the real Safe path), add a framework-level test that:

- **Pre-fix:** a synthetic proposal whose direct-EOA `propose()` consumes < cap (16.78M) — old check passes.
- **Post-fix:** the same proposal's `estimateProposeViaMultisig()` returns a required limit > cap — new check `expect(...).to.equal(true)` fails (cap enforced), reproducing the VIP-634 Part 1 scenario.

This is currently only covered indirectly via mainnet-fork simulations; no isolated unit test exists (see Issue #4).

---

## Raw Notes

- On-chain calls executed against `bscmainnet` via broker `chain.call` / `chain.get_storage`:
  - `getThreshold()` (`0xe75235b8`) → `0x…0003`
  - storage slot `0x4` → `0x…0003` (== threshold ⇒ slot 4 confirmed)
  - `getOwners()` (`0xa0e67e2b`) → 5 addresses
- `DEFAULT_PROPOSER_ADDRESS` (bscmainnet) = `0x5176671de05380379399b669ed276feec99d59cb` (`src/networkAddresses.ts:28`)
- `governorProxy` instantiation: `src/vip-framework/index.ts:189-192` → `GOVERNOR_PROXY`
- `initMainnetUser` impersonates + funds and returns the account signer: `src/utils.ts:159-175`
- `resolvePerTxGasCap`: `src/utils.ts:98-130` (EIP-7825 RPC → static map → ∞)
- Repo review confined to read-only analysis; no changes made to the PR source.
