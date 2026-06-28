pragma circom 2.1.6;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

// BatchSolvencyAggregator: Aggregates N individual issuer solvency attestations
// into a single proof that ALL issuers in a compliance set are solvent.
//
// Each issuer provides their liabilities root and sum; the aggregator proves:
//   1. Each issuer's liabilities sum <= their reserves (individual solvency)
//   2. The system-wide total liabilities = sum of all issuer liabilities
//   3. The system-wide total reserves >= system-wide total liabilities
//   4. A Poseidon-based "batch root" commits to the ordered set of issuer roots
//
// Public signals:
//   [ batch_root, total_system_liabilities, total_system_reserves, num_issuers ]

template BatchSolvencyAggregator(N) {
    // Public Inputs
    signal input total_system_liabilities;
    signal input total_system_reserves;

    // Per-issuer private inputs
    signal input issuer_roots[N];
    signal input issuer_liabilities[N];
    signal input issuer_reserves[N];

    // 1. Verify each issuer is individually solvent
    component solvencyCheck[N];
    for (var i = 0; i < N; i++) {
        solvencyCheck[i] = LessEqThan(64);
        solvencyCheck[i].in[0] <== issuer_liabilities[i];
        solvencyCheck[i].in[1] <== issuer_reserves[i];
        solvencyCheck[i].out === 1;
    }

    // 2. Verify individual liabilities sum to system total
    signal cumulative_liabilities[N + 1];
    cumulative_liabilities[0] <== 0;
    for (var i = 0; i < N; i++) {
        cumulative_liabilities[i + 1] <== cumulative_liabilities[i] + issuer_liabilities[i];
    }
    cumulative_liabilities[N] === total_system_liabilities;

    // 3. Verify individual reserves sum covers system liabilities
    signal cumulative_reserves[N + 1];
    cumulative_reserves[0] <== 0;
    for (var i = 0; i < N; i++) {
        cumulative_reserves[i + 1] <== cumulative_reserves[i] + issuer_reserves[i];
    }
    cumulative_reserves[N] === total_system_reserves;

    // 4. System-wide solvency
    component systemCheck = LessEqThan(64);
    systemCheck.in[0] <== total_system_liabilities;
    systemCheck.in[1] <== total_system_reserves;
    systemCheck.out === 1;

    // 5. Compute batch commitment root: chain Poseidon hashes of issuer roots
    //    batch_root = H(H(H(root_0, root_1), root_2), root_3)
    component batchHasher[N - 1];
    signal batch_chain[N];
    batch_chain[0] <== issuer_roots[0];
    for (var i = 0; i < N - 1; i++) {
        batchHasher[i] = Poseidon(2);
        batchHasher[i].inputs[0] <== batch_chain[i];
        batchHasher[i].inputs[1] <== issuer_roots[i + 1];
        batch_chain[i + 1] <== batchHasher[i].out;
    }

    // Output the batch root as a public signal
    signal output batch_root;
    batch_root <== batch_chain[N - 1];
}

component main {public [total_system_liabilities, total_system_reserves]} = BatchSolvencyAggregator(4);
