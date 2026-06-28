pragma circom 2.1.6;

include "node_modules/circomlib/circuits/poseidon.circom";

template MerkleSumNodeHash() {
    signal input leftHash;
    signal input leftSum;
    signal input rightHash;
    signal input rightSum;
    signal output parentHash;

    component poseidon = Poseidon(4);
    poseidon.inputs[0] <== leftHash;
    poseidon.inputs[1] <== leftSum;
    poseidon.inputs[2] <== rightHash;
    poseidon.inputs[3] <== rightSum;
    parentHash <== poseidon.out;
}

// Helper: compute the Merkle-sum-tree root + total over the compiled field, so we
// can build self-consistent public inputs for solvency.circom.
template GenSolvency(depth) {
    signal input accountIds[1 << depth];
    signal input balances[1 << depth];
    signal input salts[1 << depth];
    signal output root;
    signal output totalSum;

    var numLeaves = 1 << depth;
    signal nodeHashes[depth + 1][numLeaves];
    signal nodeSums[depth + 1][numLeaves];

    component leafHasher[numLeaves];
    for (var i = 0; i < numLeaves; i++) {
        leafHasher[i] = Poseidon(3);
        leafHasher[i].inputs[0] <== accountIds[i];
        leafHasher[i].inputs[1] <== balances[i];
        leafHasher[i].inputs[2] <== salts[i];
        nodeHashes[0][i] <== leafHasher[i].out;
        nodeSums[0][i] <== balances[i];
    }

    component nodeHasher[depth][numLeaves / 2];
    for (var d = 0; d < depth; d++) {
        var numNodes = 1 << (depth - d);
        var numParents = numNodes / 2;
        for (var i = 0; i < numParents; i++) {
            nodeHasher[d][i] = MerkleSumNodeHash();
            nodeHasher[d][i].leftHash <== nodeHashes[d][2*i];
            nodeHasher[d][i].leftSum <== nodeSums[d][2*i];
            nodeHasher[d][i].rightHash <== nodeHashes[d][2*i+1];
            nodeHasher[d][i].rightSum <== nodeSums[d][2*i+1];
            nodeHashes[d+1][i] <== nodeHasher[d][i].parentHash;
            nodeSums[d+1][i] <== nodeSums[d][2*i] + nodeSums[d][2*i+1];
        }
    }

    root <== nodeHashes[depth][0];
    totalSum <== nodeSums[depth][0];
}

component main = GenSolvency(4);
