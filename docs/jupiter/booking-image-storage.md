# Booking page images

Set the following server environment variables to connect RustFS:

- `S3_ENDPOINT`: the S3 API URL reachable from both the app server and customer browsers, such as `https://files.example.com`. A hostname with an optional port is also accepted and uses HTTP; specify `https://` explicitly for TLS
- `S3_BUCKET`: an existing private bucket
- `S3_REGION`: signing region, defaults to `eu-north-1`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

The storage credentials need `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` access to `booking-pages/*` in the bucket, plus `s3:ListBucket` restricted to that prefix. Head requests use the read permission. Path-style addressing is enabled for RustFS. Uploads pass through the app server, so bucket CORS configuration is unnecessary. Keep credentials on the server and use a dedicated bucket-scoped service account.

Admins can upload JPG, PNG, WebP and AVIF files up to 20 MB. The server validates and converts images to AVIF, strips metadata and resizes them within 1920 × 1920 pixels. Uploading, replacing and removing the image save immediately, independently of the main form. Image changes update the existing booking page metadata without a schema change.

Public image requests check that the booking page is available before redirecting to a signed read URL valid for five minutes. The bucket does not need anonymous access. Configure the app's reverse proxy to allow request bodies of at least 32 MB for base64 image uploads.

Replacing or removing an image deletes the previous object after the database change commits. Failed deletions are kept in booking-page metadata and retried on the next image change, and the admin sees an error toast. Re-saving the same image never deletes it. The appointment job removes unattached images older than 24 hours, using the same organization lock as image saves to protect attached images. Run `npm run jobs:appointments` on a schedule after building. Cleanup failures are logged per organization and retried on later runs. If bucket versioning is enabled, S3 deletion creates a delete marker; configure version lifecycle rules if old versions must also be purged.

Uploads are limited to three attempts per minute and twenty per day per organization, with thirty attempts per minute across the application. Database counters and an organization upload lock work across application instances. Each organization can hold at most twenty objects and 40 MB; the byte check reserves the maximum 20 MB output size before starting an upload. Each process runs at most two image encoders concurrently. Failed attempts consume the request budget, and discarded uploads count toward storage until cleanup removes them.

Verification:

```sh
node --experimental-strip-types tests/booking-page-image.integration.ts
node --experimental-strip-types tests/admin-booking-page.integration.ts
```

The first test uses a temporary local S3-compatible HTTP stub. The second uses the configured database and mocks object-storage calls. A real RustFS upload and read still needs verification after the environment variables are provided.

## Reusing uploads

`BookingPageCoverUpload` in `components/booking-page/booking-page-cover-upload.tsx` provides the booking page's upload control, preview, drag and drop, removal, file validation and upload feedback. `BookingPageImage` connects it to image-setting mutations and the query cache independently of the main form. The control waits for image decoding and saving before completing an upload.

`lib/storage/image-upload.ts` shares the accepted types, size limit, input schema and browser file helpers. `lib/storage/image-upload.server.ts` validates and optimizes images and creates keys for a supplied folder and organization. Mutations must authorize their caller and choose the folder on the server. Use `isScopedImageKey` when saving keys to enforce the same scope.

`lib/storage/object-storage.server.ts` handles private object writes, deletions, existence checks and signed read URLs independently of image processing or booking pages.
