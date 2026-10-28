// Profile photos. Where they're stored and how big they are.
//
// Live: a photo is a JPEG in the private "photos" bucket, in a folder named
// after its owner's user id ("<user id>/<random>.jpg"). The database checks the
// folder to decide who may see it (supabase/migrations/0003_photos.sql), and
// profiles.photo_url stores that path. The app turns a path into a short-lived
// signed URL when it needs to show the picture.

export const PHOTO_BUCKET = "photos";
/** Longest side after resizing, in pixels. Big enough for a card, small enough to upload on mobile data. */
export const PHOTO_SIZE = 512;
/** JPEG quality, 0 to 1. */
export const PHOTO_QUALITY = 0.8;
/** How long a signed URL stays valid, in seconds. */
export const PHOTO_URL_TTL_S = 3600;

/** A photo picked on the phone, already squared and shrunk: a local file plus its bytes as base64. */
export interface PickedPhoto { uri: string; base64: string }

const PATH = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/;

/** A fresh path for one of my photos. The random part just stops caches showing an old picture. */
export function newPhotoPath(userId: string, random = randomName()): string {
  return `${userId}/${random}.jpg`;
}

/** Whose photo a path is, by its folder. Null if the path isn't one of ours. */
export function photoOwner(path: string | null | undefined): string | null {
  const m = path ? PATH.exec(path) : null;
  return m ? m[1] : null;
}

export function isOwnPhotoPath(path: string | null | undefined, userId: string): boolean {
  return photoOwner(path) === userId;
}

function randomName(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
