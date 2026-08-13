import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const output = path.resolve(".next/standalone/.next/static");

await rm(output, { recursive: true, force: true });
await mkdir(path.dirname(output), { recursive: true });
await cp(path.resolve(".next/static"), output, { recursive: true });
