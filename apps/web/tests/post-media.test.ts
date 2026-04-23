import { describe, it, expect } from "vitest";
import {
  findUrlsInText,
  isDirectImageUrl,
  parseYoutubeVideoId,
  getYoutubeIdsFromText,
  getImageUrlsFromText,
  firstUnfurlableUrl,
} from "../src/lib/post-media";

describe("post-media", () => {
  it("findUrlsInText dedupes in order", () => {
    const s = "see https://a.com/x and also https://b.com";
    expect(findUrlsInText(s)).toEqual(["https://a.com/x", "https://b.com"]);
  });

  it("parseYoutubeVideoId handles common shapes", () => {
    const id = "dQw4w9WgXcQ";
    expect(parseYoutubeVideoId(`https://www.youtube.com/watch?v=${id}`)).toBe(id);
    expect(parseYoutubeVideoId(`https://youtu.be/${id}`)).toBe(id);
    expect(parseYoutubeVideoId(`https://www.youtube.com/shorts/${id}`)).toBe(id);
  });

  it("isDirectImageUrl for extensions", () => {
    expect(isDirectImageUrl("https://cdn.test/p.png")).toBe(true);
    expect(isDirectImageUrl("https://cdn.test/p.jpg?x=1")).toBe(true);
    expect(isDirectImageUrl("https://news.com/article")).toBe(false);
  });

  it("getYoutubeIdsFromText includes post url", () => {
    const id = "dQw4w9WgXcQ";
    expect(
      getYoutubeIdsFromText("", `https://www.youtube.com/watch?v=${id}`)
    ).toEqual([id]);
  });

  it("getImageUrlsFromText includes post url", () => {
    const u = "https://i.imgur.com/abc.png";
    expect(getImageUrlsFromText("", u)).toEqual([u]);
  });

  it("firstUnfurlableUrl skips YT and direct images", () => {
    const body = `vid https://youtu.be/abcdEFGHijk pic https://x.com/a.png more https://blog.test/hi`;
    expect(firstUnfurlableUrl(body, null)).toBe("https://blog.test/hi");
  });
});
