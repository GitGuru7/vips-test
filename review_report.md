# PR Review Report

## Summary

- **PR:** [VenusProtocol/vips#722](https://github.com/VenusProtocol/vips/pull/722)
- **Title:** `fix(vip-framework): enforce propose() gas cap against the real proposer-Safe execTransaction`
- **Type:** General framework code review (not a VIP governance proposal). Single file changed: `src/vip-framework/index.ts` (+111 / −27).
- **Verdict:** ⚠️ **CHANGES REQUESTED**

**One-paragraph assessment.** The core idea is correct and well‑engineered. VIPs are submitted on‑chain by the proposer Gnosis Safe via `execTransaction`, so measuring the *required gas limit* of that wrapped call (rather than the gas a direct‑EOA `propose()` consumes) is the right thing to enforce, and using `estimateGas` to fold in EIP‑150 63/64 reserves + Safe overhead is a sound, low‑maintenance approach. I verified every load‑bearing premise independently: Safe storage **slot 4 = threshold** (on‑chain + source), the **v=1 pre‑validated signature** semantics (source), the **Safe v1.4.1 SafeL2** singleton, and the near‑cap arithmetic. I also ran the framework end‑to‑end on a bscmainnet archival fork. **`simulations/vip-635/bscmainnet.ts` passes fully green** with the new check, which validates the whole mechanism (the threshold/signature hack, the estimate, and the lifecycle).

**However, three things block a clean LGTM:**

1. **The PR turns an existing committed simulation red.** Re‑running `simulations/vip-634/bscmainnet.ts` (untouched by this PR) on the PR branch now **fails** the `can be proposed` test: the new enforcement computes `requiredGasLimit = 17,121,752 = 102.05%` of the `16,777,216` cap and asserts failure. The PR changes only the framework file and does not split, skip, or otherwise resolve vip‑634, so the test suite goes red.
2. **The PR description's verification table is stale and self‑contradictory.** It claims VIP‑634 = `16,419,376 (97.86%)` "passes, warns" — but the actual figure at the committed fork block is `17,121,752 (102.05%)` which *fails*. This also contradicts the PR's own Problem section ("needs a 17.1M gas limit … reverts on‑chain"). VIP‑635 is likewise off (claimed `15,797,444 / 94.16%`; actual `15,084,752 / 89.91%`).
3. **A real correctness bug:** `isSafe(...)` and `estimateProposeViaMultisig(...)` hardcode the module‑level `DEFAULT_PROPOSER_ADDRESS` instead of the actual `options.proposer`, so the gas check measures the wrong account whenever a simulation overrides the proposer.

None of these are fatal to the design — hence CHANGES REQUESTED, not BLOCKED.

---

## Checklist

| #    | Item | Status | Verification Method | Evidence |
| ---- | ---- | ------ | ------------------- | -------- |
| 1.1  | Gnosis Safe storage **slot 4 = threshold** | ✅ PASS | On‑chain (`eth_getStorageAt`) + Safe source | `getThreshold()` → `3`; `eth_getStorageAt(proposer, 0x4)` → `0x…03`. Identical. Source: `singleton`(0),`modules`(1),`owners`(2),`ownerCount`(3),`threshold`(4) in `Safe.sol`/`OwnerManager.sol` v1.3.0 & v1.4.1. |
| 1.2  | Proposer is a Safe; singleton version | ✅ PASS | On‑chain slot 0 | `eth_getStorageAt(proposer, 0x0)` → `0x…29fcb43b46531bca003ddc8fcb67ffe91900c762` = canonical **Safe v1.4.1 SafeL2** singleton (emits `SafeMultiSigTransaction` with full calldata, consistent with the PR's "~1.1M event overhead" rationale). |
| 1.3  | **v=1 pre‑validated signature** accepted by `checkNSignatures` when `msg.sender == owner` | ✅ PASS | Safe source | `else if (v == 1) { currentOwner = address(uint160(uint256(r))); require(msg.sender == currentOwner || approvedHashes[...] != 0, "GS025"); }` — `r`=owner, `s` ignored, passes for owner‑as‑sender. |
| 1.4  | Signature byte layout `r(32) ‖ s(32) ‖ v(1)` correct | ✅ PASS | Code inspection | `"0x" + owner.slice(2).padStart(64,"0") + "0".repeat(64) + "01"` → 32‑byte left‑padded owner address (r), 32 zero bytes (s), `0x01` (v). 65 bytes, correct. |
| 1.5  | Single signature sufficient when threshold lowered to 1 (ordering moot) | ✅ PASS | Safe source | Loop runs once; `currentOwner > lastOwner(0)` trivially true. Ordering only matters for ≥2 sigs. |
| 1.6  | `hardhat_setStorageAt` value format (32‑byte padded) | ✅ PASS | Code inspection | `ethers.utils.hexZeroPad("0x1", 32)` → `0x00…01`, correct for a `uint256` slot. |
| 1.7  | `safeTxGas=0` (+ `gasPrice=0`) forwards ~all gas to inner call | ✅ PASS (nuanced) | Safe source | `execute(..., gasPrice == 0 ? (gasleft() - 2500) : safeTxGas)` — all‑gas forwarding is gated on **`gasPrice==0`**, which the call sets. Both `safeTxGas=0` and `gasPrice=0` are passed, so the estimate folds in the real forwarding. |
| 1.8  | `estimateGas` on `execTransaction` reaches the inner `propose` (sig hack works) | ✅ PASS | Live fork run | On vip‑634/635 the revert/estimate occurs *inside* the governor (nested Safe→propose frames), proving `checkSignatures` passed. Not a `GS025/GS026` signature error. |
| 1.9  | New gas line + lifecycle green when under cap | ✅ PASS | Live fork run (vip‑635) | `requiredGasLimit=15,084,752 (89.91%)`; `can be proposed ✓ / voteable ✓ / queued ✓ / executed ✓`; **83 passing**. |
| 1.10 | Enforcement correctly **fails** an over‑cap propose | ✅ PASS (works as intended) | Live fork run (vip‑634) | `requiredGasLimit 17,121,752 exceeds the bscmainnet per-tx gas cap 16777216` → assertion fails. |
| 2.1  | Near‑cap warning arithmetic (97% band) | ✅ PASS | Code inspection | `gas.lte(cap) && gas.mul(10000).gte(cap.mul(9700))` ⇒ warns iff `0.97·cap ≤ gas ≤ cap`. BigNumber math, no overflow, correct direction. `(10000−9700)/100 = 3%` label correct. |
| 2.2  | Percentage display safe (`toNumber`) | ✅ PASS | Code inspection | `gas.mul(10000).div(cap).toNumber()/100` — `gas·10000 ≈ 1.7e11 < 2^53`, safe. |
| 2.3  | `queue` / `execute` remain on consumed‑gas basis | ✅ PASS | Diff inspection | Unchanged semantics; only refactored into `reportTxGas(...)` without `enforce`. Correct (these aren't multisig‑wrapped). |
| 3.1  | **`options.proposer` honored by gas check** | ❌ FAIL | Code inspection | `isSafe(DEFAULT_PROPOSER_ADDRESS)` and `estimateProposeViaMultisig` hardcode the module constant, not `proposerAddress = options.proposer ?? DEFAULT_PROPOSER_ADDRESS`. See Issue #3. |
| 3.2  | PR description verification figures reproduce | ❌ FAIL | Live fork run | Table says 634=97.86% (passes) / 635=94.16%; actual = 102.05% (fails) / 89.91%. See Issue #2. |
| 3.3  | PR leaves test suite green | ❌ FAIL | Live fork run | `simulations/vip-634/bscmainnet.ts` fails on the PR branch. See Issue #1. |
| 4.1  | Double `isSafe` RPC call | ⚠️ ISSUE | Code inspection | `isSafe(DEFAULT_PROPOSER_ADDRESS)` called twice (lines 329 & 342). See Issue #4. |
| 4.2  | Fork state mutation reverted | ⚠️ ISSUE | Code inspection | Threshold→1 via `hardhat_setStorageAt` is never restored. Harmless here, but an un‑cleaned global mutation. See Issue #5. |
| 4.3  | Estimate vs real multi‑sig (threshold 3) | ⚠️ INFO | Source reasoning | Single‑sig estimate slightly *under*-estimates real (fewer ecrecover + less calldata). Author acknowledges (~few k gas). Unsafe direction but immaterial vs warning band. |
| 4.4  | Unit tests for `isSafe` / `estimateProposeViaMultisig` | ⚠️ INFO | Repo search | None; exercised only indirectly via simulations. |

---

## Issues Found

| #  | Severity | Location | Description | Evidence |
| -- | -------- | -------- | ----------- | -------- |
| 1  | **High** | `src/vip-framework/index.ts` (effect on `simulations/vip-634/bscmainnet.ts`) | The new enforcement turns an existing, committed simulation **red**. vip‑634's `propose()` requires `17,121,752` gas (102.05% of cap) at its pinned fork block, so `can be proposed` now fails. The PR does not split/skip/annotate vip‑634, so CI for that sim goes red. Either VIP‑634 must be split (the deprecation appears split into Part 1/Part 2 = vip‑634/vip‑635) or its sim updated/removed as part of this change — otherwise the branch can't go green. (This may be the *intended* catch, but the PR must then handle the fallout.) | `can be proposed:` →<br>`propose() via proposer-Safe execTransaction requiredGasLimit 17121752 exceeds the bscmainnet per-tx gas cap 16777216` (FORK_BLOCK `104562598`). |
| 2  | **Medium** | PR description (Verification table) | The description's results table is **stale and self‑contradictory**. It claims VIP‑634 = `16,419,376 (97.86%)` "passes, warns" — but the PR's own Problem section says VIP‑634 needs **17.1M** and reverts, and the live figure is `17,121,752 (102.05%)` which *fails*. VIP‑635 claimed `15,797,444 (94.16%)`; live = `15,084,752 (89.91%)`. Both VIPs are off by ~700K — itself a demonstration of the very state‑drift the PR's warning targets. Reviewers trusting the table would conclude both VIPs pass; one does not. Update the table (and note it's a moving figure). | Live runs below; cap = `16,777,216`. |
| 3  | **Medium** | `index.ts:233,239` (`estimateProposeViaMultisig`), `index.ts:329,342` (`isSafe`) | `DEFAULT_PROPOSER_ADDRESS` is hardcoded instead of `proposerAddress = options.proposer ?? DEFAULT_PROPOSER_ADDRESS` (line 271). When a sim sets `options.proposer`, the cap is enforced against the **default** Safe while the actual proposal is submitted by a different account; and because `enforce` for the direct call is `!(await isSafe(DEFAULT_PROPOSER_ADDRESS))` (= false), the *real* proposer's `propose()` gas is never enforced at all. 13 sims pass `proposer:` (e.g. `vip-173` → `0xc444…2391`, `vip-263` → `0x55A9…168D`). Thread `proposerAddress` through `isSafe`/`estimateProposeViaMultisig`. | `index.ts:271` defines `proposerAddress`; `index.ts:329/342` & `estimateProposeViaMultisig` ignore it. |
| 4  | **Low** | `index.ts:329,342` | `isSafe(DEFAULT_PROPOSER_ADDRESS)` is awaited twice in the same `it` (two `getThreshold()` RPC round‑trips). Compute once and reuse. | Two `await isSafe(...)` calls in `can be proposed`. |
| 5  | **Low** | `index.ts:237–241` | `estimateProposeViaMultisig` sets the Safe threshold to 1 via `hardhat_setStorageAt` and never restores it; the mutation persists into later `it` blocks. Verified harmless (vote/queue/execute impersonate the proposer directly and don't route through `execTransaction`), but it's an un‑cleaned global fork mutation — prefer snapshot/restore or write back the original threshold. | `hardhat_setStorageAt(DEFAULT_PROPOSER_ADDRESS, "0x4", 1)` with no revert. |
| 6  | **Info** | `index.ts` new functions | No standalone unit tests for `isSafe` / `estimateProposeViaMultisig`; only indirect coverage. A tiny fixture asserting `isSafe(safe)==true`, `isSafe(eoa)==false`, and a known estimate would lock in behavior. | Repo search: no test references the new symbols. |

---

## Verified Items (positive findings)

| Area | Result |
| ---- | ------ |
| Safe slot 4 = threshold | ✅ On‑chain (`0x…03`) matches `getThreshold()` = 3, matches source layout |
| Safe singleton | ✅ v1.4.1 SafeL2 `0x29fcb43b…c762` |
| v=1 signature semantics & byte layout | ✅ Correct per Safe source |
| `safeTxGas=0 + gasPrice=0` ⇒ forward all gas | ✅ Correct (gated on gasPrice==0) |
| `estimateGas` reaches inner propose (hack works) | ✅ Demonstrated on fork (nested governor frames; no GS025/GS026) |
| Near‑cap 97% warning math | ✅ Correct & overflow‑safe |
| `queue`/`execute` unchanged (consumed gas) | ✅ Correct |
| End‑to‑end lifecycle under cap | ✅ vip‑635 → 83 passing, all lifecycle steps green |
| Over‑cap detection | ✅ vip‑634 correctly flagged at 102.05% |

---

## Live Fork Evidence (bscmainnet archival fork)

Cap = `PER_TX_GAS_CAP_2_24` = `16,777,216` (2²⁴). Both vip‑634 and vip‑635 pin `FORK_BLOCK = 104562598`.

```
# vip-635 (Part 2) — PASSES
[gas] VIP-635 … propose() via proposer-Safe execTransaction requiredGasLimit=15084752 (89.91% of bscmainnet per-tx cap 16777216)
[gas] VIP-635 … propose() direct call gasUsed=14085231 (83.95% of bscmainnet per-tx cap 16777216)
  ✔ can be proposed  ✔ should be voteable  ✔ should be queued  ✔ should be executed
  83 passing

# vip-634 (Part 1) — FAILS enforcement (works as designed, but suite goes red)
[gas] VIP-634 … propose() via proposer-Safe execTransaction requiredGasLimit=17121752 (102.05% of bscmainnet per-tx cap 16777216)
  1) can be proposed:
     propose() via proposer-Safe execTransaction requiredGasLimit 17121752 exceeds the
     bscmainnet per-tx gas cap 16777216; split or trim the VIP so it fits a single on-chain transaction
```

On‑chain verification of the proposer Safe `0x5176671de05380379399b669ed276feec99d59cb`:

```
getThreshold()              -> 3
eth_getStorageAt(.., 0x4)   -> 0x..03      # slot 4 == threshold ✔
eth_getStorageAt(.., 0x0)   -> 0x..29fcb43b46531bca003ddc8fcb67ffe91900c762   # Safe v1.4.1 SafeL2 singleton
getOwners()                 -> 5 owners (owner[0] = 0xf23ac67516c4817e5eacc6b993c84283f438db2b)
```

---

## Test Execution Scripts

```bash
# Step 1: Clone and checkout the PR
cd /tmp && rm -rf vips-pr-722 && \
gh repo clone VenusProtocol/vips vips-pr-722 -- --depth 50 && \
cd vips-pr-722 && \
git fetch origin pull/722/head:pr-722 && \
git checkout pr-722 && \
yarn install

# Step 2a: Validate the new path GREEN end-to-end (under cap)
ARCHIVE_NODE_bscmainnet=<bsc-archive-url> \
npx hardhat test simulations/vip-635/bscmainnet.ts --fork bscmainnet
#   expect: [gas] … requiredGasLimit=15084752 (89.91% …) ; 83 passing

# Step 2b: Reproduce the over-cap enforcement failure (PR turns this sim red)
ARCHIVE_NODE_bscmainnet=<bsc-archive-url> \
npx hardhat test simulations/vip-634/bscmainnet.ts --fork bscmainnet
#   expect: [gas] … requiredGasLimit=17121752 (102.05% …) ; "can be proposed" FAILS

# Step 3 (suggested fix for Issue #3): thread the real proposer through the gas check.
#   - add `proposerAddress` as a param to isSafe()/estimateProposeViaMultisig()
#   - call isSafe(proposerAddress) once, reuse the boolean (fixes Issue #4)
#   - estimateProposeViaMultisig(proposerAddress, proposeCalldata)
# Then a sim with options.proposer set to a non-Safe EOA should NOT take the
# multisig path, and a sim with a *different* Safe proposer should be measured
# against THAT Safe.
```

> Note: this is a bscmainnet *governance‑framework* change, not a VIP. There is no new VIP file to simulate in isolation; validation is by running existing simulations through the modified `testVip` path (above). No reproduction test was *added* to the PR because the behavioral change is already exercised — and reproduced — by the existing vip‑634 (failing) and vip‑635 (passing) simulations.

---

## Raw Notes

- Safe semantics cross‑checked against `safe-global/safe-smart-account` v1.3.0 (`GnosisSafe.sol`) and v1.4.1 (`Safe.sol`, `SafeL2.sol`, `OwnerManager.sol`, `Executor.sol`). Storage layout and the `v==1` / ordering / gas‑forwarding logic are identical across both.
- The ~700K gap between the PR's table and live numbers for *both* VIPs is consistent with mainnet state drift (proposalCount growth, cold→warm SLOAD changes) between the author's measurement and the pinned fork block — the exact failure mode the new 97% warning is meant to surface.
- Single‑signature (threshold=1) estimate under‑estimates the real threshold‑3 submission by a few thousand gas (fewer `ecrecover`s + ~130 bytes less signature calldata in the `SafeMultiSigTransaction` log). Author acknowledges this; it is immaterial vs the warning band, though it is the *unsafe* direction.
