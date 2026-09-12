import { execFile } from "child_process";
import { promisify } from "util";
import { rm } from "fs/promises";

import { isValidGitHubRepositoryUrl } from "../validation/repository.validation.js";

const execFileAsync = promisify(execFile);

export async function cloneRepository(url: string): Promise<string> {
  if (!isValidGitHubRepositoryUrl(url)) {
    throw new Error("Invalid GitHub repository URL");
  }

  const destination = `/tmp/repository-${Date.now()}`;

  await execFileAsync(
    "git",
    [
      "clone",
      "--depth",
      "1",
      url,
      destination,
    ],
    {
      timeout: 30_000,
    }
  );

  return destination;
}

export async function cleanupRepository(
  repositoryPath: string
): Promise<void> {
  await rm(repositoryPath, {
    recursive: true,
    force: true,
  });
}