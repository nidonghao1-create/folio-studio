import { cp, mkdir, rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const path of ["index.html", "src", "public"])
  await cp(path, `dist/${path}`, { recursive: true });
process.stdout.write("Built static site in dist/\n");
