// src/lib/findMeditation.ts
import { ref, getDownloadURL, getStorage, type FirebaseStorage } from 'firebase/storage';
import { firebaseApp, storage } from '@/lib/firebase';

type MeditationMode = 'touch' | 'sit' | 'stay';

function pathForMode(mode: MeditationMode): string {
  // Firebase storage mapping requested by user:
  // 001.mp3 -> 30s (touch), 002.mp3 -> 2m (sit), 003.mp3 -> 15m (stay)
  if (mode === 'touch') return 'meditations/001.mp3';
  if (mode === 'sit') return 'meditations/002.mp3';
  return 'meditations/003.mp3';
}

function uniqueBuckets(): string[] {
  const raw = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '').trim();
  if (!raw) return [];
  const base = raw.replace(/^gs:\/\//, '');
  const out = new Set<string>([base]);
  if (base.endsWith('.firebasestorage.app')) out.add(base.replace('.firebasestorage.app', '.appspot.com'));
  if (base.endsWith('.appspot.com')) out.add(base.replace('.appspot.com', '.firebasestorage.app'));
  return Array.from(out);
}

async function tryGet(path: string, targetStorage: FirebaseStorage): Promise<string | null> {
  try {
    return await getDownloadURL(ref(targetStorage, path));
  } catch {
    return null;
  }
}

export async function findMeditationURL(mode: MeditationMode): Promise<string | null> {
  const path = pathForMode(mode);
  const fallbackPath = 'meditations/003.mp3';
  const buckets = uniqueBuckets();

  // 1) Try default storage from firebase config.
  const direct = await tryGet(path, storage);
  if (direct) return direct;

  // 2) Try both bucket aliases (.firebasestorage.app / .appspot.com) to avoid launch-time bucket mismatch.
  for (const bucket of buckets) {
    const byBucket = await tryGet(path, getStorage(firebaseApp, `gs://${bucket}`));
    if (byBucket) return byBucket;
  }

  console.warn(`Audio missing (${path}), trying fallback ${fallbackPath}`);

  // 3) Fallback audio on default bucket.
  const fallbackDirect = await tryGet(fallbackPath, storage);
  if (fallbackDirect) return fallbackDirect;

  // 4) Fallback audio on alias buckets.
  for (const bucket of buckets) {
    const byBucketFallback = await tryGet(fallbackPath, getStorage(firebaseApp, `gs://${bucket}`));
    if (byBucketFallback) return byBucketFallback;
  }
  return null;
}

