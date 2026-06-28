pragma circom 2.1.6;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/eddsaposeidon.circom";

// Merkle-Sum Tree Node Hashing template
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

// Solvency Proof Circuit for Crisp (e.g. depth 4, 16 accounts)
template SolvencyVerifier(depth) {
    // Public Inputs
    signal input expectedLiabilitiesRoot;
    signal input expectedLiabilitiesSum;
    signal input reserves;
    signal input issuerAx;   // public: issuer BabyJubjub pubkey x
    signal input issuerAy;   // public: issuer BabyJubjub pubkey y

    // Private Inputs
    signal input accountIds[1 << depth];
    signal input balances[1 << depth];
    signal input salts[1 << depth];

    // EdDSA-Poseidon signature (private) binding the issuer to this root.
    signal input sigS;
    signal input sigR8x;
    signal input sigR8y;

    // Total leaves = 2^depth
    var numLeaves = 1 << depth;
    
    // Node hashes and sums at each level
    signal nodeHashes[depth + 1][numLeaves];
    signal nodeSums[depth + 1][numLeaves];

    // 1. Compute Leaf Hashes and Sums
    component leafHasher[numLeaves];
    component balanceRange[numLeaves];
    for (var i = 0; i < numLeaves; i++) {
        leafHasher[i] = Poseidon(3);
        leafHasher[i].inputs[0] <== accountIds[i];
        leafHasher[i].inputs[1] <== balances[i];
        leafHasher[i].inputs[2] <== salts[i];

        nodeHashes[0][i] <== leafHasher[i].out;
        nodeSums[0][i] <== balances[i];

        // Assert no negative balance (balances are unsigned signals in circom, but we verify limit)
        balanceRange[i] = LessEqThan(64);
        balanceRange[i].in[0] <== 0;
        balanceRange[i].in[1] <== balances[i];
        balanceRange[i].out === 1;
    }

    // 2. Build Tree Layers
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

    // 3. Constrain Root Node against Public Outputs
    expectedLiabilitiesRoot === nodeHashes[depth][0];
    expectedLiabilitiesSum === nodeSums[depth][0];

    // 4. Solvency Range Check: reserves >= total_liabilities (expectedLiabilitiesSum)
    component solvencyCheck = LessEqThan(64);
    solvencyCheck.in[0] <== expectedLiabilitiesSum;
    solvencyCheck.in[1] <== reserves;
    solvencyCheck.out === 1;

    // 5. Verify the issuer's EdDSA-Poseidon signature over the liabilities root.
    //    Only the holder of the issuer's BabyJubjub private key can produce a
    //    valid attestation; (issuerAx, issuerAy) is a public input so the
    //    contract can check the signer is a registered issuer.
    component sigVerifier = EdDSAPoseidonVerifier();
    sigVerifier.enabled <== 1;
    sigVerifier.Ax <== issuerAx;
    sigVerifier.Ay <== issuerAy;
    sigVerifier.S <== sigS;
    sigVerifier.R8x <== sigR8x;
    sigVerifier.R8y <== sigR8y;
    sigVerifier.M <== expectedLiabilitiesRoot;
}

component main {public [expectedLiabilitiesRoot, expectedLiabilitiesSum, reserves, issuerAx, issuerAy]} = SolvencyVerifier(4);
