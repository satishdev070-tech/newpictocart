import { isVariantable, pickVariantWidth, storeAssetPathFromUrl } from "@/lib/storage/variants";

/**
 * next/image loader (next.config images.loaderFile). Store images become /api/img, which
 * redirects to a pre-sized WebP copy in Supabase Storage (made on upload, or once on first
 * request). Unsplash stock photos get a `w` parameter. Nothing goes through Vercel Image Optimization. Other images (static SVGs in /public,
 * GIF/SVG uploads) are used as they are. Runs on server and client: keep it pure.
 */
export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  // Unsplash stock photos (theme imagery) are resized by Unsplash's own image CDN.
  if (src.startsWith("https://images.unsplash.com/")) {
    const u = new URL(src);
    u.searchParams.set("w", String(width));
    return u.toString();
  }
  const path = storeAssetPathFromUrl(src);
  if (!path || !isVariantable(path)) return src;
  return `/api/img?p=${encodeURIComponent(path)}&w=${pickVariantWidth(width)}`;
}
