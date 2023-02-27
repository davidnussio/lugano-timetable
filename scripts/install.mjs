import { parse } from "@typescript-eslint/typescript-estree";
import { execa } from "execa";
import { access, readFile, constants } from "fs/promises";

import packageJson from "../package.json" assert { type: "json" };

const filterType = (type) => (node) => node.type === type;

const sourceValue = (node) => node.source.value;

const alreadyInstalledDeps = (deps) => (dep) => !deps[dep];

const checkPackageManagerLockfile = async (packageManager, lockFile) =>
  access(lockFile, constants.F_OK)
    .then(() => packageManager)
    .catch(() => false);

const getPackageManager = async () => {
  const pkg = await Promise.allSettled([
    checkPackageManagerLockfile("npm", "./package-lock.json"),
    checkPackageManagerLockfile("pnpm", "./pnpm-lock.yaml"),
    checkPackageManagerLockfile("yarn", "./yarn.lock"),
  ]);

  return pkg.find((p) => p.value)?.value || "npm";
};

const installDependency = async (deps) => {
  console.log(typeof deps, deps.length);
  if (deps.length === 0) {
    console.log("No dependencies to install");
    return Promise.resolve();
  }
  const cmd = await getPackageManager();
  const args = ["add", ...deps];
  console.log(`Installing ${deps.join(" ")}...`);

  console.log(cmd, args);

  return execa(cmd, args, {
    stdout: process.stdout,
    stderr: process.stderr,
    cwd: process.cwd(),
  });
};

const code = await readFile("./src/ui/utils/cn.ts", "utf-8");

const ast = parse(code, {
  loc: false,
  range: false,
});

// TODO: Working with git status
// const res = await execa("git", ["status", "--short"], {
//   all: true,
//   cwd: process.cwd(),
// });

// console.log(res.stdout.split("\n").filter((s) => s.match(/\.tsx?/)));

const deps = ast.body
  .filter(filterType("ImportDeclaration"))
  .map(sourceValue)
  .filter(alreadyInstalledDeps(packageJson.dependencies));

await installDependency(deps);
