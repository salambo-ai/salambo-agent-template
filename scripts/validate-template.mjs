import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const expectedTools = ["read", "write", "edit", "bash"];
const validateCanonicalDefaults =
  process.env.SALAMBO_CANONICAL_TEMPLATE === "1";
const forbiddenPaths = [
  ".dockerignore",
  ".github/workflows/docker.yml",
  "Dockerfile",
  "docker-compose.yml",
  "sandbox/Dockerfile",
  "sandbox/entrypoint.sh",
  "sandbox/packages.mjs",
  "salambo.missing-secret.yaml",
  "tools",
  "workspace",
];

validateForbiddenPaths();
validateManagedPackages();
const manifest = validateManifest();
if (validateCanonicalDefaults) {
  validateDefaultAgent(manifest);
}
validateDryDeployment();

console.log("Salambo managed agent template is valid.");

function validateForbiddenPaths() {
  const present = forbiddenPaths.filter((filePath) => existsSync(filePath));
  if (present.length > 0) {
    throw new Error(
      `Legacy template paths are not allowed: ${present.join(", ")}`,
    );
  }
}

function validateManagedPackages() {
  const packages = JSON.parse(readFileSync("sandbox/packages.json", "utf8"));
  const keys = Object.keys(packages).sort();
  const expectedKeys = ["apt", "npm", "pip", "version"];

  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    throw new Error("sandbox/packages.json contains unsupported fields.");
  }

  if (packages.version !== 1) {
    throw new Error("sandbox/packages.json version must be 1.");
  }

  for (const manager of ["apt", "npm", "pip"]) {
    const entries = packages[manager];
    if (
      !Array.isArray(entries) ||
      entries.some((entry) => typeof entry !== "string")
    ) {
      throw new Error(
        `sandbox/packages.json ${manager} must be an array of strings.`,
      );
    }
  }
}

function validateManifest() {
  const result = spawnSync("salambo", ["manifest", "--path", ".", "--json"], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "salambo manifest failed.");
  }

  const output = JSON.parse(result.stdout);
  if (output.ok !== true) {
    throw new Error("salambo manifest did not return a successful result.");
  }

  if (!Array.isArray(output.diagnostics)) {
    throw new Error("salambo manifest diagnostics are missing.");
  }

  if (output.diagnostics.length > 0) {
    const messages = output.diagnostics.map((item) => item.message).join("; ");
    throw new Error(`salambo manifest returned diagnostics: ${messages}`);
  }

  return output.manifest;
}

function validateDefaultAgent(manifest) {
  const activeTools = manifest?.brain?.tools?.activeToolNames;
  if (JSON.stringify(activeTools) !== JSON.stringify(expectedTools)) {
    throw new Error(
      `Expected active tools ${expectedTools.join(", ")}, received ${String(activeTools)}.`,
    );
  }

  const model = manifest?.brain?.model;
  if (
    model?.provider !== "openai" ||
    model.modelId !== "gpt-5.2" ||
    model.thinkingLevel !== "low"
  ) {
    throw new Error(
      "Canonical template must use OpenAI gpt-5.2 with low thinking.",
    );
  }
}

function validateDryDeployment() {
  const result = spawnSync("salambo", ["deploy", "--dry-run", "--json"], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "salambo deploy --dry-run failed.");
  }

  const output = JSON.parse(result.stdout);
  const packages = output.sourceArchive?.sandboxPackages;
  if (packages?.path !== "sandbox/packages.json" || packages.version !== 1) {
    throw new Error(
      "Dry deployment did not include managed sandbox packages v1.",
    );
  }
}
