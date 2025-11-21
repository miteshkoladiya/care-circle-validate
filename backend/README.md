# CareCircle Backend

Minimal TypeScript + Express + Mongoose backend scaffold.

Quick start:

1. copy `.env.example` to `.env` and edit values
2. cd backend
3. npm install
4. npm run dev

API base: http://localhost:5000/api

Optional: Cloudinary

To store uploaded doctor documents in Cloudinary instead of the local uploads folder, set the following env vars in your `.env` (copy from `.env.example`):

- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

When provided, uploaded files during registration are sent to Cloudinary and `user.doctorDocument` will contain the Cloudinary secure URL. If Cloudinary is not configured the server will continue to save files under `uploads/` and serve them at `/uploads`.

Data uniqueness and cleanup
---------------------------

This project now enforces several uniqueness constraints at the database/schema level:

- `User.email` is unique.
- `Community.name` is unique (case-insensitive collation).
- `JoinRequest` has a composite unique index on `(userId, communityId)`.
- `CommunityRequest` has a composite unique index on `(userId, name)`.

If you already have production data you should run the included dedupe script before deploying these schema changes to avoid index creation failures:

```
cd backend
node scripts/dedupe.js --mongoUri "mongodb://..."
```

The script keeps the earliest document (by createdAt) and removes later duplicates. Back up your database before running.

RAG (Python) wrapper
---------------------

If you have a Python-based RAG implementation (for example `ML_model/rag_service.py`), you can expose it as an HTTP service and point the backend to it using `RAG_API_URL`.

Example using the included FastAPI wrapper (`ML_model/rag_api.py`):

1. Create a Python virtualenv and install dependencies:

```powershell
cd ML_model
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install fastapi uvicorn
```

2. Run the wrapper (port 9000):

```powershell
uvicorn rag_api:app --reload --port 9000
```

3. Set the backend environment variable to call it:

```
RAG_API_URL=http://localhost:9000/api/rag
```

4. Restart the backend. When `RAG_API_URL` is set the backend will prefer calling your RAG service for question answering.


