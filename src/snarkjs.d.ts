// snarkjs ships no TypeScript types; declare the surface we use.
declare module "snarkjs" {
  export const groth16: {
    fullProve(
      input: Record<string, unknown>,
      wasmFile: string,
      zkeyFile: string,
    ): Promise<{ proof: unknown; publicSignals: string[] }>;
    verify(
      vk: unknown,
      publicSignals: string[],
      proof: unknown,
    ): Promise<boolean>;
  };
  export const wtns: {
    calculate(
      input: Record<string, unknown>,
      wasmFile: string,
      wtnsFile: string,
    ): Promise<void>;
    exportJson(wtnsFile: string): Promise<bigint[]>;
  };
}
