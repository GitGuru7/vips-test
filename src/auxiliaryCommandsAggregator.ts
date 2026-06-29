import { Signer } from "ethers";
import { FORKED_NETWORK, ethers } from "hardhat";

// Canonical AuxiliaryCommandsAggregator deployments, keyed by network. These are the
// new aggregators brought into service by VIP-628 (ownership accepted by the Normal
// Timelock, the three timelocks granted executeBatch/add/removeAuthorizedBatchers).
export const AUXILIARY_AGGREGATORS: Record<string, string> = {
  ethereum: "0xc79Cb7efEBd121DC4B39eA141C214606595D665A",
  arbitrumone: "0x768FEf3a88ea92cCF9CAcDf0aB15C4B29B3C1379",
  basemainnet: "0x768FEf3a88ea92cCF9CAcDf0aB15C4B29B3C1379",
  zksyncmainnet: "0x0B906d55025cE88bF713764AAc6F23918a25fA49",
  bscmainnet: "0x528A428748dfE73DFcc844176B401475D1831057",
};

// Resolve the aggregator for a given network. Pass the network explicitly from a
// per-network data file (a bscmainnet VIP file is imported by remote-chain sims, so
// the network-defaulting form would resolve to the wrong chain there).
export function getAuxiliaryAggregator(network?: string): string {
  const net = network ?? FORKED_NETWORK ?? process.env.HARDHAT_NETWORK ?? "";
  const aggregator = AUXILIARY_AGGREGATORS[net];
  if (!aggregator) {
    throw new Error(`No AuxiliaryCommandsAggregator known for network "${net}"`);
  }
  return aggregator;
}

export interface SeedCommand {
  target: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any[];
  signature: string;
}

export const AGGREGATOR_SEED_ABI = [
  "function addBatch((address target, bytes data)[] calldata calls, uint256 expectedIndex) external returns (uint256 index)",
  "function batchCount() external view returns (uint256)",
  "function getBatch(uint256 index) external view returns (tuple(address target, bytes data)[])",
  "function authorizedBatchers(address) external view returns (bool)",
];

function encodeCalldata(signature: string, params: unknown[]): string {
  const iface = new ethers.utils.Interface([`function ${signature}`]);
  return iface.encodeFunctionData(signature, params);
}

// Encode SeedCommands into the aggregator's Call[] tuple form.
export function encodeSeedCommands(commands: SeedCommand[]): { target: string; data: string }[] {
  return commands.map(cmd => ({ target: cmd.target, data: encodeCalldata(cmd.signature, cmd.params) }));
}

// Append a batch on the aggregator for the active/forked network using the indexed
// addBatch overload, asserting it lands at `expectedIndex`. `signer` defaults to the
// first signer; pass an impersonated authorized batcher when seeding on a fork.
export async function seedAuxiliaryAggregator(
  commands: SeedCommand[],
  expectedIndex: number,
  signer?: Signer,
  network?: string,
): Promise<number> {
  if (commands.length === 0) {
    throw new Error("commands array is empty — nothing to seed");
  }
  const aggregatorAddress = getAuxiliaryAggregator(network);
  const sender = signer ?? (await ethers.getSigners())[0];
  const aggregator = new ethers.Contract(aggregatorAddress, AGGREGATOR_SEED_ABI, sender);

  const currentCount: number = (await aggregator.batchCount()).toNumber();
  if (currentCount !== expectedIndex) {
    throw new Error(
      `Aggregator ${aggregatorAddress} has ${currentCount} batch(es) but expected next index ${expectedIndex}.`,
    );
  }

  const calls = encodeSeedCommands(commands);
  const tx = await aggregator["addBatch((address,bytes)[],uint256)"](calls, expectedIndex);
  await tx.wait();
  return currentCount;
}
