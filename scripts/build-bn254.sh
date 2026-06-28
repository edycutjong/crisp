#!/usr/bin/env bash
# Rebuild the Crisp solvency circuit + Groth16 keys over BN254 (bn128) and
# regenerate the on-chain verifier fixture (contracts/crisp_oracle/src/zk_fixture.rs).
# Reusable: re-run after any circuit edit. Run from anywhere; cd's to repo root.
set -euo pipefail
cd "$(dirname "$0")/.."
SJ="node_modules/.bin/snarkjs"
B="circuits/build"
POW="${POW:-16}"
mkdir -p "$B"

echo "==> compile circuits over bn128 (circom default prime)"
circom circuits/solvency.circom     --r1cs --wasm -o "$B" -l .
circom circuits/gen_solvency.circom --r1cs --wasm -o "$B" -l .

if [ -f "$B/potbn_final.ptau" ]; then
  echo "==> reusing existing bn128 ptau ($B/potbn_final.ptau)"
else
  echo "==> powers of tau (bn128, 2^$POW)"
  "$SJ" powersOfTau new bn128 "$POW" "$B/potbn_0.ptau" -v
  "$SJ" powersOfTau contribute "$B/potbn_0.ptau" "$B/potbn_1.ptau" --name=c1 -v -e="crisp-bn254-$(date +%s)"
  "$SJ" powersOfTau prepare phase2 "$B/potbn_1.ptau" "$B/potbn_final.ptau" -v
fi

echo "==> groth16 setup + verification key"
"$SJ" groth16 setup "$B/solvency.r1cs" "$B/potbn_final.ptau" "$B/s_0.zkey"
"$SJ" zkey contribute "$B/s_0.zkey" "$B/s_final.zkey" --name=c1 -v -e="crisp-bn254-zkey-$(date +%s)"
"$SJ" zkey export verificationkey "$B/s_final.zkey" "$B/vk.json"

echo "==> generate deterministic fixture proof + Rust fixture"
node circuits/build/gen-fixture-proof.mjs
node circuits/build/convert.js

echo "==> done. curve = $(node -e "console.log(require('./circuits/build/vk.json').curve)")"
