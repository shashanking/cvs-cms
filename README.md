# CVS CMS

A web application for managing proposals, plans, and projects in one place. Integrates Supabase for authentication, database, and storage, and Google Sheets for budget management.

## Tech Stack
- Next.js
- Supabase (Auth, Tables, Storage)
- Google Sheets API

## Features
- Admin dashboard (6 admins initially, add employees later)
- Project creation with automatic folder structure:
  - finance
  - tech
  - invoices
  - proposals
  - reports
- Media storage in Supabase Storage
- Budget integration with Google Sheets

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up your Supabase project and get the API keys.
3. Configure environment variables in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   GOOGLE_SHEETS_ID=your-google-sheet-id
   GOOGLE_SERVICE_ACCOUNT_CREDS=your-google-service-account-json
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## Folder Structure
- `/pages` - Next.js pages
- `/components` - React components

---

## Current Progress (as of 2025-05-15)

### File Upload & Audit Logging
- **File uploads** now use a unique file name format: `timestamp_originalname.ext`.
- This unique name is used for all actions (upload, preview, download) and is displayed in the files list.
- **Audit logging** is standardized: every upload, preview, and download action logs the same unique file name for consistency across the system.

### Notifications System
- **Notification badge** now shows only the count of unread notifications (files you have not yet previewed or downloaded).
- Badge count and notification list update in real-time as you interact with files.
- Notifications and audit logs are always in sync, using the unique file name as the reference.

### UI/UX
- The files list, audit logs, and notifications all reference the unique file name for every file.
- Immediate feedback after upload: new files appear instantly with their unique names.

### Next Steps
- Further user feedback and testing.
- Optionally, add user-friendly display of original file names alongside unique names.
- Consider migration/deduplication for legacy audit log data if needed.

---
- `/lib` - Utility libraries (Supabase, Google Sheets)

## TODO
- [ ] Supabase schema setup
- [ ] Auth & admin setup
- [ ] Project creation & folder logic
- [ ] Google Sheets integration
- [ ] UI/UX improvements
