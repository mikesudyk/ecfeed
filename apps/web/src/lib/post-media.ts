/** Same character class as PostCard `linkifyBody` (URL runs until delimiter). */
const URL_IN_TEXT = /https?:\/\/[^\s<>"]+[^\s<>".,;:!?)'"\]]/g;

export function findUrlsInText(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(new RegExp(URL_IN_TEXT.source, "g"))) {
    const u = m[0];
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg)(\?|#|$)/i;

/**
 * Heuristic: direct link to an image file (suitable to render as <img>).
 * Does not try to HEAD-request — avoids wrong positives on HTML pages.
 */
export function isDirectImageUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (IMAGE_EXT.test(url)) return true;
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h === "i.imgur.com" && !/gallery|\/a\//i.test(url)) return true;
  } catch {
    return false;
  }
  return false;
}

/** Returns 11-char video id, or null if not a watchable YouTube URL. */
export function parseYoutubeVideoId(urlString: string): string | null {
  try {
    const u = new URL(urlString);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{10,}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (u.pathname === "/watch" || u.pathname.startsWith("/watch")) {
        const v = u.searchParams.get("v");
        return v && /^[\w-]{10,}$/.test(v) ? v : null;
      }
      if (u.pathname.startsWith("/embed/")) {
        const id = u.pathname.split("/")[2];
        return id && /^[\w-]{10,}$/.test(id) ? id : null;
      }
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        return id && /^[\w-]{10,}$/.test(id) ? id : null;
      }
      if (u.pathname.startsWith("/live/")) {
        const id = u.pathname.split("/")[2];
        return id && /^[\w-]{10,}$/.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function isYoutubeUrl(url: string): boolean {
  return parseYoutubeVideoId(url) !== null;
}

function uniqueOrderedYoutubeIds(urls: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    const id = parseYoutubeVideoId(u);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function uniqueImageUrls(urls: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    if (!isDirectImageUrl(u) || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/** All candidate URLs: body, then optional post.url (deduped, order preserved). */
export function collectPostMediaUrls(body: string, postUrl: string | null | undefined): string[] {
  const fromBody = findUrlsInText(body);
  if (!postUrl?.trim() || fromBody.includes(postUrl.trim())) {
    return fromBody;
  }
  return [...fromBody, postUrl.trim()];
}

export function getYoutubeIdsFromText(body: string, postUrl: string | null | undefined): string[] {
  return uniqueOrderedYoutubeIds(collectPostMediaUrls(body, postUrl));
}

export function getImageUrlsFromText(body: string, postUrl: string | null | undefined): string[] {
  return uniqueImageUrls(collectPostMediaUrls(body, postUrl));
}

/**
 * First non-YouTube, non–direct-image http(s) URL — good candidate for link unfurl.
 * Order: URLs as they first appear in `body`, then `postUrl` if not already present.
 */
export function firstUnfurlableUrl(body: string, postUrl: string | null | undefined): string | null {
  for (const u of collectPostMediaUrls(body, postUrl)) {
    if (isYoutubeUrl(u) || isDirectImageUrl(u)) continue;
    return u;
  }
  return null;
}
