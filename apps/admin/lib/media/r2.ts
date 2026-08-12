import {
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
