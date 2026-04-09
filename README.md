# exams

A minimal app for uploading exam files with login and JSON-backed storage.

## Run locally

1. Install dependencies with `npm install`.
2. Start the server with `npm start`.
3. Open `http://localhost:3000` in your browser.

## Default login

If you do not set environment variables, use `admin` for the username and `exam1234` for the password.

You can override them with `EXAM_APP_USERNAME`, `EXAM_APP_PASSWORD`, and `SESSION_SECRET`.

## What it does

- Requires login before any upload.
- Stores uploaded files in `data/exam-db.json` instead of a local uploads folder.
- Shows recent uploads and download links for signed-in users.