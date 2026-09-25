import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type { RepositoryFile } from "./file.service.js";
import type { RepoFileIndex } from "../types/repo.js";
import type { RepositoryTreeNode } from "./repository-tree.service.js";

const AWS_REGION = process.env.AWS_REGION;
const S3_BUCKET = process.env.AWS_S3_BUCKET;

if (!AWS_REGION) {
  throw new Error("AWS_REGION is not configured");
}

if (!S3_BUCKET) {
  throw new Error("AWS_S3_BUCKET is not configured");
}

const s3 = new S3Client({
  region: AWS_REGION,
});

function repositoryPrefix(repositoryId: string): string {
  return `repositories/${repositoryId}`;
}

function fileKey(repositoryId: string, filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, "/");

  return `${repositoryPrefix(repositoryId)}/files/${normalizedPath}`;
}

async function putJson(
  key: string,
  value: unknown,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: JSON.stringify(value, null, 2),
      ContentType: "application/json",
    }),
  );
}

async function getJson<T>(key: string): Promise<T | null> {
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      }),
    );

    if (!response.Body) {
      return null;
    }

    const body = await response.Body.transformToString();

    return JSON.parse(body) as T;
  } catch (error: any) {
    if (error?.name === "NoSuchKey") {
      return null;
    }

    throw error;
  }
}

export async function saveRepositoryFiles(
  repositoryId: string,
  files: RepositoryFile[],
): Promise<void> {
  console.log(
    `[S3] Saving ${files.length} repository files for ${repositoryId}`,
  );

  await Promise.all(
    files.map(async (file) => {
      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: fileKey(repositoryId, file.path),
          Body: file.content,
          ContentType: "text/plain; charset=utf-8",
        }),
      );
    }),
  );

  console.log(
    `[S3] Saved ${files.length} repository files for ${repositoryId}`,
  );
}

export async function getRepositoryFile(
  repositoryId: string,
  filePath: string,
): Promise<RepositoryFile | null> {
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: fileKey(repositoryId, filePath),
      }),
    );

    if (!response.Body) {
      return null;
    }

    const content = await response.Body.transformToString();

    return {
      path: filePath,
      content,
    };
  } catch (error: any) {
    if (error?.name === "NoSuchKey") {
      return null;
    }

    throw error;
  }
}

export async function saveRepositoryTree(
  repositoryId: string,
  tree: RepositoryTreeNode,
): Promise<void> {
  await putJson(
    `${repositoryPrefix(repositoryId)}/tree.json`,
    tree,
  );

  console.log(`[S3] Repository tree saved: ${repositoryId}`);
}

export async function getRepositoryTree(
  repositoryId: string,
): Promise<RepositoryTreeNode | null> {
  return getJson<RepositoryTreeNode>(
    `${repositoryPrefix(repositoryId)}/tree.json`,
  );
}

export async function saveRepositoryIndex(
  repositoryId: string,
  repositoryIndex: RepoFileIndex,
): Promise<void> {
  await putJson(
    `${repositoryPrefix(repositoryId)}/index.json`,
    repositoryIndex,
  );

  console.log(`[S3] Repository index saved: ${repositoryId}`);
}

export async function getRepositoryIndex(
  repositoryId: string,
): Promise<RepoFileIndex | null> {
  return getJson<RepoFileIndex>(
    `${repositoryPrefix(repositoryId)}/index.json`,
  );
}

export async function saveArchitectureMap(
  repositoryId: string,
  architectureMap: unknown,
): Promise<void> {
  await putJson(
    `${repositoryPrefix(repositoryId)}/architecture.json`,
    architectureMap,
  );

  console.log(
    `[S3] Architecture map saved: ${repositoryId}`,
  );
}

export async function getArchitectureMap<T = unknown>(
  repositoryId: string,
): Promise<T | null> {
  return getJson<T>(
    `${repositoryPrefix(repositoryId)}/architecture.json`,
  );
}

export interface RepositoryMetadata {
  repositoryId: string;
  url: string;
  status:
    | "queued"
    | "indexing"
    | "architecture"
    | "embedding"
    | "completed"
    | "failed";
  progress: number;
  updatedAt: string;
}

export async function saveRepositoryMetadata(
  metadata: RepositoryMetadata,
): Promise<void> {
  await putJson(
    `${repositoryPrefix(metadata.repositoryId)}/metadata.json`,
    metadata,
  );
}

export async function getRepositoryMetadata(
  repositoryId: string,
): Promise<RepositoryMetadata | null> {
  return getJson<RepositoryMetadata>(
    `${repositoryPrefix(repositoryId)}/metadata.json`,
  );
}