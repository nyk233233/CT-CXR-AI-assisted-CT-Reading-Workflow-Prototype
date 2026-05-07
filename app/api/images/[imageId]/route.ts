import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { NextResponse } from "next/server";
import { imageRefsByStudy } from "@/lib/mock/data";

function findImageUri(imageId: string): string | undefined {
  return Object.values(imageRefsByStudy)
    .flat()
    .find((imageRef) => imageRef.imageId === imageId)?.uri;
}

function uriToLocalPath(uri: string): string | undefined {
  if (uri.startsWith("file:///mnt/e/")) {
    return `E:\\${uri.replace("file:///mnt/e/", "").replaceAll("/", "\\")}`;
  }

  if (uri.startsWith("file:///mnt/d/")) {
    return `D:\\${uri.replace("file:///mnt/d/", "").replaceAll("/", "\\")}`;
  }

  if (uri.match(/^file:\/\/\/[A-Za-z]:\//)) {
    return uri.replace("file:///", "").replaceAll("/", "\\");
  }

  return undefined;
}

function contentTypeForPath(path: string): string {
  const extension = extname(path).toLowerCase();

  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";

  return "application/octet-stream";
}

export async function GET(_: Request, context: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await context.params;
  const uri = findImageUri(decodeURIComponent(imageId));
  const path = uri ? uriToLocalPath(uri) : undefined;

  if (!uri || !path) {
    return NextResponse.json(
      { message: "Image not found or unsupported image URI.", imageId, uri },
      { status: 404 },
    );
  }

  try {
    const bytes = await readFile(path);
    return new Response(bytes, {
      headers: {
        "Content-Type": contentTypeForPath(path),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Unable to read local image.",
        imageId,
        uri,
        path,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 404 },
    );
  }
}
