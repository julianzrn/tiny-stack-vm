// A tiny stack virtual machine for make.fun's tiny stack ISA, version 1
// (the kit's generator/subject/ISA.md defines it; this is an independent
// implementation). The grader runs `node main.ts`: every instance in the
// input directory (MAKEFUN_INPUT_DIR, default /input) is executed, its
// exact output bytes go to <output>/<id>/stdout.bin and its exit code to
// <output>/<id>/exit.txt. Machine: 32-bit wrapping integers, data stack
// at most 256 values, call stack at most 64 return addresses, 256 words
// of memory, at most 1,000,000 steps and 65,536 output bytes per program.
// A trap ends a program at once, the trap's code as its exit code, and
// keeps the output written before it.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STACK_MAX = 256, CALLS_MAX = 64, MEM_WORDS = 256;
const STEP_MAX = 1_000_000, OUT_MAX = 65_536, INT_MIN = -2147483648;
// Trap exit codes (ISA.md "Traps").
const T_UNDER = 2, T_OVER = 3, T_DIV0 = 4, T_OPCODE = 5, T_MEM = 6;
const T_DEPTH = 7, T_RET = 8, T_PC = 9, T_STEPS = 10, T_OUT = 11;

// [opcode, immediate bytes, pops, pushes] for every opcode the ISA names;
// any byte not listed here is an unknown opcode (trap 5).
const OP_TABLE = [
  [0x00,0,0,0],[0x01,1,0,1],[0x02,4,0,1],[0x03,0,1,0],[0x04,0,1,2],[0x05,0,2,2],
  [0x06,0,2,3],[0x07,0,3,3],[0x10,0,2,1],[0x11,0,2,1],[0x12,0,2,1],[0x13,0,2,1],
  [0x14,0,2,1],[0x15,0,2,1],[0x16,0,2,1],[0x17,0,1,1],[0x18,0,2,1],[0x19,0,2,1],
  [0x1a,0,2,1],[0x1b,0,1,1],[0x1c,0,2,1],[0x1d,0,2,1],[0x1e,0,2,1],[0x20,0,2,1],
  [0x21,0,2,1],[0x22,0,2,1],[0x30,2,0,0],[0x31,2,1,0],[0x32,2,1,0],[0x33,2,0,0],
  [0x34,0,0,0],[0x40,0,1,1],[0x41,0,2,0],[0x50,0,1,0],[0x51,0,1,0],[0x52,0,0,1],
  [0x53,0,1,0],
];
const IMM = new Int8Array(256).fill(-1);
const POPS = new Int8Array(256), PUSHS = new Int8Array(256);
for (const [byte, imm, pops, pushs] of OP_TABLE) {
  IMM[byte] = imm; POPS[byte] = pops; PUSHS[byte] = pushs;
}

// The two-operand operations (ADD..LTU in opcode order); DIV0 comes back
// instead of a number when a division-like opcode has a zero divisor.
const DIV0 = Symbol('div0');
function binop(op, a, b) {
  switch (op) {
    case 0x10: return (a + b) | 0;
    case 0x11: return (a - b) | 0;
    case 0x12: return Math.imul(a, b);
    case 0x13:
      return b === 0 ? DIV0 : a === INT_MIN && b === -1 ? a : (a / b) | 0;
    case 0x14:
      return b === 0 ? DIV0 : b === -1 ? 0 : (a % b) | 0;
    case 0x15: return b === 0 ? DIV0 : Math.floor((a >>> 0) / (b >>> 0)) | 0;
    case 0x16: return b === 0 ? DIV0 : ((a >>> 0) % (b >>> 0)) | 0;
    case 0x18: return a & b;
    case 0x19: return a | b;
    case 0x1a: return a ^ b;
    case 0x1c: return a << (b & 31);
    case 0x1d: return a >> (b & 31);
    case 0x1e: return (a >>> (b & 31)) | 0;
    case 0x20: return a === b ? 1 : 0;
    case 0x21: return a < b ? 1 : 0;
    default: return (a >>> 0) < (b >>> 0) ? 1 : 0;
  }
}

function run(prog, input) {
  const n = prog.length;
  const S = new Int32Array(STACK_MAX), C = new Int32Array(CALLS_MAX);
  const M = new Int32Array(MEM_WORDS), out = new Uint8Array(OUT_MAX);
  let sp = 0, csp = 0, olen = 0, inPos = 0, pc = 0, steps = 0;
  const done = (exit) => ({ out: Buffer.from(out.subarray(0, olen)), exit });

  for (;;) {
    // One step, its checks in ISA.md's order.
    if (steps === STEP_MAX) return done(T_STEPS);
    if (pc < 0 || pc >= n) return done(T_PC);
    const op = prog[pc];
    const imm = IMM[op];
    if (imm < 0) return done(T_OPCODE);
    if (pc + imm >= n) return done(T_PC);
    steps++;
    if (sp < POPS[op]) return done(T_UNDER);
    if (sp - POPS[op] + PUSHS[op] > STACK_MAX) return done(T_OVER);
    const next = pc + 1 + imm;
    pc = next;

    switch (op) {
      case 0x00: return done(0);
      case 0x01: S[sp++] = (prog[next - 1] << 24) >> 24; break;
      case 0x02:
        S[sp++] = prog[next - 4] | (prog[next - 3] << 8) |
          (prog[next - 2] << 16) | (prog[next - 1] << 24);
        break;
      case 0x03: sp--; break;
      case 0x04: S[sp] = S[sp - 1]; sp++; break;
      case 0x05: { // SWAP
        const t = S[sp - 1]; S[sp - 1] = S[sp - 2]; S[sp - 2] = t; break;
      }
      case 0x06: S[sp] = S[sp - 2]; sp++; break;
      case 0x07: { // ROT: ( a b c -- b c a )
        const a = S[sp - 3];
        S[sp - 3] = S[sp - 2]; S[sp - 2] = S[sp - 1]; S[sp - 1] = a;
        break;
      }
      case 0x17: S[sp - 1] = (-S[sp - 1]) | 0; break;
      case 0x1b: S[sp - 1] = ~S[sp - 1]; break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15:
      case 0x16: case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d:
      case 0x1e: case 0x20: case 0x21: case 0x22: {
        const r = binop(op, S[sp - 2], S[sp - 1]);
        if (r === DIV0) return done(T_DIV0);
        sp--;
        S[sp - 1] = r;
        break;
      }
      case 0x30: case 0x31: case 0x32: { // JMP / JZ / JNZ: signed offset from next
        const rel = ((prog[next - 2] | (prog[next - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 0x30) {
          const v = S[--sp];
          take = op === 0x31 ? v === 0 : v !== 0;
        }
        if (take) pc = next + rel;
        break;
      }
      case 0x33:
        if (csp === CALLS_MAX) return done(T_DEPTH);
        C[csp++] = next;
        pc = prog[next - 2] | (prog[next - 1] << 8);
        break;
      case 0x34:
        if (csp === 0) return done(T_RET);
        pc = C[--csp];
        break;
      case 0x40: { // LOAD
        const addr = S[sp - 1];
        if (addr < 0 || addr >= MEM_WORDS) return done(T_MEM);
        S[sp - 1] = M[addr]; break;
      }
      case 0x41: { // STORE: ( v addr -- )
        const addr = S[sp - 1];
        if (addr < 0 || addr >= MEM_WORDS) return done(T_MEM);
        M[addr] = S[sp - 2]; sp -= 2; break;
      }
      case 0x50: { // PRINT: decimal ASCII, no newline
        const s = String(S[sp - 1]);
        if (olen + s.length > OUT_MAX) return done(T_OUT);
        sp--;
        for (let i = 0; i < s.length; i++) out[olen++] = s.charCodeAt(i);
        break;
      }
      case 0x51:
        if (olen + 1 > OUT_MAX) return done(T_OUT);
        out[olen++] = S[--sp] & 255;
        break;
      case 0x52:
        S[sp++] = inPos < input.length ? input[inPos++] : -1;
        break;
      case 0x53: return done(S[--sp] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const { out, exit } = run(readFileSync(join(I, id, 'program.bin')),
    readFileSync(join(I, id, 'input.bin')));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), out);
  writeFileSync(join(O, id, 'exit.txt'), `${exit}\n`);
}
