import crypto from "crypto";

export interface LeafData {
  accountId: string;
  balance: bigint;
  salt: string;
}

export interface MerkleSumNode {
  hash: string;
  sum: bigint;
}

export interface SiblingNode {
  hash: string;
  sum: bigint;
  isRight: boolean;
}

export interface InclusionProof {
  leafHash: string;
  balance: bigint;
  path: SiblingNode[];
}

// Environment-safe SHA-256 hash function (supports Node.js and browser)
export async function hashSha256(message: string): Promise<string> {
  if (typeof window === "undefined") {
    // Node.js environment
    return crypto.createHash("sha256").update(message).digest("hex");
  } else {
    // Browser environment
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}

// Simulated Poseidon2 Hash function using SHA-256 prefix for cryptographic simulation
export async function hashPoseidon2(message: string): Promise<string> {
  return hashSha256(`poseidon2:${message}`);
}

export class MerkleSumTree {
  private leaves: LeafData[];
  private layers: MerkleSumNode[][];
  private usePoseidon: boolean;

  constructor(leaves: LeafData[], usePoseidon = true) {
    if (leaves.length === 0) {
      throw new Error("Cannot build an empty Merkle-Sum Tree");
    }
    // Pad leaves to next power of 2
    this.leaves = [...leaves];
    this.usePoseidon = usePoseidon;
    this.layers = [];
  }

  // Hash elements according to selected primitive
  private async hash(msg: string): Promise<string> {
    return this.usePoseidon ? hashPoseidon2(msg) : hashSha256(msg);
  }

  // Pad leaves with dummy accounts to a power of 2
  private padLeaves() {
    const power = Math.ceil(Math.log2(this.leaves.length));
    const targetLength = Math.max(1, Math.pow(2, power));

    // Add dummy accounts with 0 balance
    while (this.leaves.length < targetLength) {
      this.leaves.push({
        accountId: `GA_DUMMY_${this.leaves.length}`,
        balance: 0n,
        salt: `dummy_${this.leaves.length}`,
      });
    }
  }

  // Asynchronous tree builder
  public async build(): Promise<void> {
    this.padLeaves();

    // Leaf layer
    const leafNodes: MerkleSumNode[] = [];
    for (const leaf of this.leaves) {
      // H_leaf = Hash(Account ID, Balance, Salt)
      const leafHash = await this.hash(
        `${leaf.accountId}-${leaf.balance.toString()}-${leaf.salt}`,
      );
      leafNodes.push({
        hash: leafHash,
        sum: BigInt(leaf.balance),
      });
    }

    this.layers.push(leafNodes);

    // Build upper layers
    let currentLayer = leafNodes;
    while (currentLayer.length > 1) {
      const nextLayer: MerkleSumNode[] = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = currentLayer[i + 1];

        // H_parent = Hash(H_left, S_left, H_right, S_right)
        // S_parent = S_left + S_right
        const parentHash = await this.hash(
          `${left.hash}-${left.sum.toString()}-${right.hash}-${right.sum.toString()}`,
        );
        const parentSum = left.sum + right.sum;

        nextLayer.push({
          hash: parentHash,
          sum: parentSum,
        });
      }
      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }
  }

  public getRoot(): MerkleSumNode {
    if (
      this.layers.length === 0 ||
      this.layers[this.layers.length - 1].length === 0
    ) {
      throw new Error("Tree not built yet. Call build() first.");
    }
    return this.layers[this.layers.length - 1][0];
  }

  // Get inclusion proof for an account
  public getProof(accountId: string): InclusionProof {
    if (this.layers.length === 0) {
      throw new Error("Tree not built yet. Call build() first.");
    }

    const leafIndex = this.leaves.findIndex((l) => l.accountId === accountId);
    if (leafIndex === -1) {
      throw new Error(`Account ${accountId} not found in tree`);
    }

    const path: SiblingNode[] = [];
    let currentIndex = leafIndex;

    const leafNode = this.layers[0][leafIndex];

    for (
      let layerIndex = 0;
      layerIndex < this.layers.length - 1;
      layerIndex++
    ) {
      const layer = this.layers[layerIndex];
      const isRight = currentIndex % 2 === 1;
      const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;

      const sibling = layer[siblingIndex];
      path.push({
        hash: sibling.hash,
        sum: sibling.sum,
        isRight: !isRight, // is the sibling on the right side of the parent?
      });

      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      leafHash: leafNode.hash,
      balance: BigInt(this.leaves[leafIndex].balance),
      path,
    };
  }

  // Static inclusion verification helper
  /* istanbul ignore next */
  public static async verifyProof(
    rootHash: string,
    totalLiabilities: bigint,
    accountId: string,
    balance: bigint,
    salt: string,
    proof: SiblingNode[],
    usePoseidon = true,
  ): Promise<boolean> {
    const hashFn = usePoseidon ? hashPoseidon2 : hashSha256;
    let currentHash = await hashFn(
      `${accountId}-${balance.toString()}-${salt}`,
    );
    let currentSum = BigInt(balance);

    for (const sibling of proof) {
      let combinedStr = "";
      if (sibling.isRight) {
        // Sibling is to the right
        combinedStr = `${currentHash}-${currentSum.toString()}-${sibling.hash}-${sibling.sum.toString()}`;
      } else {
        // Sibling is to the left
        combinedStr = `${sibling.hash}-${sibling.sum.toString()}-${currentHash}-${currentSum.toString()}`;
      }
      currentHash = await hashFn(combinedStr);
      currentSum = currentSum + BigInt(sibling.sum);
    }

    return currentHash === rootHash && currentSum === BigInt(totalLiabilities);
  }
}
