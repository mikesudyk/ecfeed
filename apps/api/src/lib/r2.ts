import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MAX_IMAGE_SIZE_MB, ACCEPTED_IMAGE_TYPES } from "@ecfeed/shared";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "ecfeed-assets";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function getPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  if (!ACCEPTED_IMAGE_TYPES.includes(contentType)) {
    throw new Error(`Invalid content type: ${contentType}`);
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: MAX_IMAGE_SIZE_MB * 1024 * 1024,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 }); // 10 min
  const publicUrl = `${R2_PUBLIC_URL}/${key}`;

  return { uploadUrl, publicUrl };
}

export function getAvatarKey(userId: string, filename: string): string {
  const ext = filename.split(".").pop() || "jpg";
  return `avatars/${userId}/avatar.${ext}`;
}

export function getPostImageKey(postId: string, filename: string): string {
  const ext = filename.split(".").pop() || "jpg";
  const timestamp = Date.now();
  return `images/${postId}/${timestamp}.${ext}`;
}
