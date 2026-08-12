import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const keySegmentPattern = /^[A-Za-z0-9_-]{1,128}$/;
const supportedMimeTypes = new Map([
  ["audio/mpeg", "mp3"],
  ["audio/mp4", "m4a"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export interface R2Configuration {
  accessKeyId: string;
  accountId: string;
  editorialBucket: string;
  releaseBucket: string;
  secretAccessKey: string;
}

export function r2Configuration(environment = process.env): R2Configuration {
  const values = {
    accessKeyId: environment.R2_ACCESS_KEY_ID,
    accountId: environment.R2_ACCOUNT_ID,
    editorialBucket: environment.R2_EDITORIAL_BUCKET ?? "ottam-editorial",
    releaseBucket: environment.R2_RELEASE_BUCKET ?? "ottam-releases",
    secretAccessKey: environment.R2_SECRET_ACCESS_KEY,
  };
  if (!values.accessKeyId || !values.accountId || !values.secretAccessKey) {
    throw new Error("Cloudflare R2 credentials are not configured.");
  }
  return values as R2Configuration;
}

export function immutableObjectKey(args: {
  candidateIndex: number;
  episodeId: string;
  jobId: string;
  mimeType: string;
  sceneId: string;
}): string {
  const { candidateIndex, episodeId, jobId, mimeType, sceneId } = args;
  const extension = supportedMimeTypes.get(mimeType);
  if (
    !extension ||
    ![episodeId, jobId, sceneId].every((value) =>
      keySegmentPattern.test(value),
    ) ||
    !Number.isSafeInteger(candidateIndex) ||
    candidateIndex < 0 ||
    candidateIndex > 2
  ) {
    throw new Error(
      "Cannot create an immutable key from invalid object metadata.",
    );
  }
  return `episodes/${episodeId}/scenes/${sceneId}/jobs/${jobId}/candidate-${String(candidateIndex + 1)}.${extension}`;
}

export function releaseAudioKey(args: {
  assetId: string;
  mimeType: string;
  releaseId: string;
}): string {
  const extension = supportedMimeTypes.get(args.mimeType);
  if (
    !extension ||
    ![args.assetId, args.releaseId].every((value) =>
      keySegmentPattern.test(value),
    )
  ) {
    throw new Error("Cannot create a release key from invalid metadata.");
  }
  return `releases/${args.releaseId}/audio/${args.assetId}.${extension}`;
}

export function releaseManifestKey(releaseId: string): string {
  if (!keySegmentPattern.test(releaseId)) {
    throw new Error("Cannot create a manifest key from an invalid release ID.");
  }
  return `releases/${releaseId}/manifest.json`;
}

export function checksumSha256(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

function client(configuration: R2Configuration): S3Client {
  return new S3Client({
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
    endpoint: `https://${configuration.accountId}.r2.cloudflarestorage.com`,
    region: "auto",
  });
}

export async function uploadEditorialCandidate(args: {
  bytes: Uint8Array;
  configuration: R2Configuration;
  key: string;
  mimeType: string;
}): Promise<{ bytes: number; checksum: string }> {
  const { bytes, configuration, key, mimeType } = args;
  if (
    !supportedMimeTypes.has(mimeType) ||
    bytes.byteLength < 1 ||
    bytes.byteLength > 100_000_000
  ) {
    throw new Error("Candidate type or size is not supported.");
  }
  const checksum = checksumSha256(bytes);
  const s3 = client(configuration);
  await s3.send(
    new PutObjectCommand({
      Body: bytes,
      Bucket: configuration.editorialBucket,
      ContentLength: bytes.byteLength,
      ContentType: mimeType,
      Key: key,
      Metadata: { "sha256-hex": checksum },
    }),
  );
  const head = await s3.send(
    new HeadObjectCommand({ Bucket: configuration.editorialBucket, Key: key }),
  );
  if (
    head.ContentLength !== bytes.byteLength ||
    head.ContentType !== mimeType ||
    head.Metadata?.["sha256-hex"] !== checksum
  ) {
    throw new Error("R2 object verification failed after upload.");
  }
  return { bytes: bytes.byteLength, checksum };
}

export async function signedEditorialReadUrl(args: {
  configuration: R2Configuration;
  key: string;
  ttlSeconds?: number;
}): Promise<string> {
  const ttlSeconds = args.ttlSeconds ?? 300;
  if (ttlSeconds < 1 || ttlSeconds > 900 || !args.key.startsWith("episodes/")) {
    throw new Error("Signed read request is invalid.");
  }
  return await getSignedUrl(
    client(args.configuration),
    new GetObjectCommand({
      Bucket: args.configuration.editorialBucket,
      Key: args.key,
    }),
    { expiresIn: ttlSeconds },
  );
}

export async function copyEditorialAssetToRelease(args: {
  configuration: R2Configuration;
  expectedBytes: number;
  expectedChecksum: string;
  key: string;
  mimeType: string;
  sourceKey: string;
}): Promise<void> {
  const s3 = client(args.configuration);
  await s3.send(
    new CopyObjectCommand({
      Bucket: args.configuration.releaseBucket,
      CopySource: `${args.configuration.editorialBucket}/${encodeURIComponent(args.sourceKey).replaceAll("%2F", "/")}`,
      Key: args.key,
      Metadata: { "sha256-hex": args.expectedChecksum },
      MetadataDirective: "REPLACE",
      ContentType: args.mimeType,
    }),
  );
  const head = await s3.send(
    new HeadObjectCommand({
      Bucket: args.configuration.releaseBucket,
      Key: args.key,
    }),
  );
  if (
    head.ContentLength !== args.expectedBytes ||
    head.ContentType !== args.mimeType ||
    head.Metadata?.["sha256-hex"] !== args.expectedChecksum
  ) {
    throw new Error("R2 release copy verification failed.");
  }
}

export async function uploadReleaseManifest(args: {
  bytes: Uint8Array;
  configuration: R2Configuration;
  key: string;
}): Promise<{ bytes: number; checksum: string }> {
  if (args.bytes.byteLength < 2 || args.bytes.byteLength > 5_000_000) {
    throw new Error("Release manifest size is invalid.");
  }
  const checksum = checksumSha256(args.bytes);
  const s3 = client(args.configuration);
  await s3.send(
    new PutObjectCommand({
      Body: args.bytes,
      Bucket: args.configuration.releaseBucket,
      ContentLength: args.bytes.byteLength,
      ContentType: "application/json",
      Key: args.key,
      Metadata: { "sha256-hex": checksum },
    }),
  );
  const head = await s3.send(
    new HeadObjectCommand({
      Bucket: args.configuration.releaseBucket,
      Key: args.key,
    }),
  );
  if (
    head.ContentLength !== args.bytes.byteLength ||
    head.ContentType !== "application/json" ||
    head.Metadata?.["sha256-hex"] !== checksum
  ) {
    throw new Error("R2 release manifest verification failed.");
  }
  return { bytes: args.bytes.byteLength, checksum };
}

export async function signedReleaseReadUrl(args: {
  configuration: R2Configuration;
  key: string;
  ttlSeconds?: number;
}): Promise<string> {
  const ttlSeconds = args.ttlSeconds ?? 300;
  if (ttlSeconds < 1 || ttlSeconds > 900 || !args.key.startsWith("releases/")) {
    throw new Error("Signed release read request is invalid.");
  }
  return await getSignedUrl(
    client(args.configuration),
    new GetObjectCommand({
      Bucket: args.configuration.releaseBucket,
      Key: args.key,
    }),
    { expiresIn: ttlSeconds },
  );
}
