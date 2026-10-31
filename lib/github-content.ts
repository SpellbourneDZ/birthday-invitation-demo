import { createHash } from "node:crypto";
import { parseContent, type InvitationContent } from "./content.ts";

const FILE = "content/invitation.json";
export class PublishError extends Error {
  status: number;
  constructor(message: string, status = 503) { super(message); this.status = status; }
}

export function githubConfigured() {
  return !!process.env.INVITATION_GITHUB_TOKEN && /^[\w.-]+\/[\w.-]+$/.test(process.env.INVITATION_GITHUB_REPOSITORY || "");
}

async function api(path: string, body?: unknown, method = "POST") {
  if (!githubConfigured()) throw new PublishError("Публикация в GitHub не настроена");
  const response = await fetch(`https://api.github.com/repos/${process.env.INVITATION_GITHUB_REPOSITORY}/${path}`, {
    method: body === undefined ? "GET" : method,
    headers: { Authorization: `Bearer ${process.env.INVITATION_GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2026-03-10" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store", signal: AbortSignal.timeout(15_000), redirect: "error",
  });
  if (!response.ok) throw new PublishError(response.status === 409 || response.status === 422 ? "Ветка изменилась. Загрузите свежую версию и повторите правки." : "GitHub недоступен. Проверьте токен, репозиторий и права Contents: write.", response.status === 409 || response.status === 422 ? 409 : 503);
  return response.json();
}

async function snapshot() {
  const branch = process.env.INVITATION_GITHUB_BRANCH || "main";
  const ref = await api(`git/ref/heads/${encodeURIComponent(branch)}`);
  const file = await api(`contents/${FILE}?ref=${ref.object.sha}`);
  return { branch, head: ref.object.sha as string, revision: file.sha as string, content: parseContent(JSON.parse(Buffer.from(file.content, "base64").toString("utf8"))) };
}

export async function readGithubContent() {
  const { revision, content } = await snapshot();
  return { revision, content };
}

// Only raster formats are uploaded: SVG/HTML and arbitrary repository paths are never accepted.
export function decodeImage(source: string) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(source);
  if (!match) throw new PublishError("Нужен PNG, JPEG или WebP", 400);
  const bytes = Buffer.from(match[2], "base64");
  const valid = match[1] === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid || bytes.length > 500_000 || bytes.toString("base64") !== match[2]) throw new PublishError("Изображение повреждено или больше 500 КБ", 400);
  const path = `uploads/${createHash("sha256").update(bytes).digest("hex")}.${match[1]}`;
  return { bytes, path };
}

export async function publishContent(input: InvitationContent, revision: string) {
  const content = parseContent(input);
  const current = await snapshot();
  if (revision !== current.revision) throw new PublishError("Содержимое уже изменилось. Загрузите свежую версию перед публикацией.", 409);
  const commit = await api(`git/commits/${current.head}`);
  const uploads = new Map<string, Buffer>();
  function image(source: string) {
    if (!source.startsWith("data:")) return source;
    const { bytes, path } = decodeImage(source);
    uploads.set(path, bytes);
    return `/${path}`;
  }
  content.event.wishlistImage = image(content.event.wishlistImage);
  content.gifts = content.gifts.map(gift => ({ ...gift, image: image(gift.image) }));
  const files = await Promise.all([...uploads].map(async ([path, bytes]) => {
    const blob = await api("git/blobs", { content: bytes.toString("base64"), encoding: "base64" });
    return { path: `public/${path}`, mode: "100644", type: "blob", sha: blob.sha };
  }));
  const tree = await api("git/trees", { base_tree: commit.tree.sha, tree: [...files, { path: FILE, mode: "100644", type: "blob", content: JSON.stringify(content, null, 2) + "\n" }] });
  const next = await api("git/commits", { message: "Update invitation content from admin", tree: tree.sha, parents: [current.head] });
  // Never force-push: a concurrent edit must produce a conflict, not overwrite another commit.
  await api(`git/refs/heads/${encodeURIComponent(current.branch)}`, { sha: next.sha, force: false }, "PATCH");
  return { commit: next.sha, content };
}
