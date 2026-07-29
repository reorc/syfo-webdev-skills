# Assets and media

## Inventory first

Record:

- Total artifact bytes.
- File count.
- Largest files.
- Asset types and licensing.
- Whether audio/video seeking requires Range support.
- Whether assets change independently from application releases.

## Source-controlled assets

Keeping media in `public/` is acceptable when the artifact remains inside the approved Syfo/FC budget and releases are intentionally coupled to those assets.

Do not inherit vendor-specific upload commands or storage paths from reference templates. If assets must be externalized, use a platform-approved object store and document URL ownership, access control, caching, CORS, lifecycle, and rollback behavior.

## Validation

- Request representative assets directly.
- Check content type and content length.
- Send a byte-range request and expect 206 plus a valid `Content-Range` for audio/video.
- Exercise browser playback and seeking.
- Verify missing assets return 404 rather than HTML with status 200.
