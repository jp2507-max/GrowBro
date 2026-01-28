---
name: Plant photo sync+offline
overview: 'Implement robust plant profile photo handling: persistent local storage, Supabase Storage upload with correct RLS pathing, and on-demand download/caching so images work across devices and offline.'
todos:
  - id: plant-local-storage
    content: Add plant profile photo local storage helper (document/plant-photos) and switch plant photo capture flows to use it.
    status: pending
  - id: rls-safe-upload
    content: Fix plant image upload path to `plant-images/${userId}/${plantId}/${filename}`; enqueue uploads when plant photo changes; update plant metadata with remote path after upload.
    status: pending
  - id: on-demand-download
    content: Implement on-demand download/caching from remote path to local file URI and update plant record.
    status: pending
  - id: protect-legacy-photos
    content: Include plant image file URIs in janitor referenced list + update tests.
    status: pending
  - id: queue-trigger
    content: Ensure image upload queue is processed from an existing app/sync trigger so uploads actually run.
    status: pending
---

# Robust plant profile images (cross-device + offline)

**Rules applied**: Offline-first

## What I found (why this regressed)

- Plant UI renders `plant.imageUrl` directly as an `expo-image` URI (`file://` or `https://`).
- Plant photo capture currently stores into the same directory used by harvest photos.
- The startup “photo janitor” only treats **harvest photo URIs** as referenced, so plant photos can be deleted as “orphans” after restart.
- For cloud sync, `plant-images` is a **private** bucket with owner-folder RLS (`(storage.foldername(name))[1] = auth.uid()`). Any upload path that doesn’t start with `${userId}/…` will be denied.

## Target behavior

- **Same device**: plant profile photo always shows and stays available offline (even after app restart).
- **Other device**: photo appears after download and remains available offline thereafter.

## Plan

### 1) Dedicated local storage for plant profile photos

- Add a plant-specific storage helper (new TS file) that stores plant profile photos under a persistent folder (e.g. `Paths.document.uri + 'plant-photos/'`).
- Update plant photo capture flows to use this helper:
  - [`src/components/plants/hero-photo-section.tsx`](src/components/plants/hero-photo-section.tsx)
  - [`src/screens/plants/plant-detail-screen.tsx`](src/screens/plants/plant-detail-screen.tsx)

### 2) Persist remote reference + upload in background (RLS-safe)

- Reuse the existing `image_upload_queue` pipeline, but fix the upload path to satisfy bucket RLS:
  - Update [`src/lib/uploads/image-upload.ts`](src/lib/uploads/image-upload.ts) / [`src/lib/uploads/queue.ts`](src/lib/uploads/queue.ts) so plant uploads go to:
    - `bucket = 'plant-images'`
    - `path = ${userId}/${plantId}/${filename}`
- When a plant profile photo is saved locally, enqueue an upload with a content-addressed filename (we can reuse the hashed filename already produced locally).
- On successful upload, update the plant record to store the remote storage path (e.g., in `plants.metadata.imagePath` or similar) and trigger a best-effort plant sync.

### 3) Download & cache on-demand on other devices

- Add a small helper (hook/service) that:
  - If `plant.imageUrl` (local file) is missing but a remote storage path exists, generates a signed URL (`supabase.storage.from('plant-images').createSignedUrl(...)`), downloads it, stores it in `plant-photos/`, and writes the new local `file://` URI back to the plant record.
- Call this helper from plant list + detail rendering paths so downloads happen automatically when needed.

### 4) Stop the janitor from deleting legacy plant photos

- Extend [`src/lib/media/photo-storage-helpers.ts`](src/lib/media/photo-storage-helpers.ts) so `getReferencedPhotoUris()` includes plant local `imageUrl` URIs (filter to `file://`).
- Update [`src/lib/media/__tests__/photo-storage-helpers.test.ts`](src/lib/media/__tests__/photo-storage-helpers.test.ts) accordingly.

### 5) Wire queue processing (if not already)

- Ensure `processImageQueueOnce()` is invoked from an existing sync trigger (e.g., after a successful sync run or on app resume), so uploads actually happen without user intervention.

## Local verification

- Unit tests:

```bash
pnpm test photo-storage-helpers -- --coverage --coverageReporters="text"
```

- Manual QA:
  - Device A: set plant photo, confirm it shows immediately, restart app, confirm it still shows offline.
  - Device A online: wait for upload to complete, then trigger a plant pull on Device B.
  - Device B: open plants list/detail, confirm photo downloads and persists offline.

## Risks

- Requires careful handling to avoid overwriting a local `file://` image with a remote-only value during pull.
- Signed URLs expire; we must store **remote path**, not the signed URL.
- Storage growth: if we keep old remote images, consider cleanup strategy later.
