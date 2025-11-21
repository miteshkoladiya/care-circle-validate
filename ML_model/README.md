# ML_model

This folder contains a minimal Retrieval-Augmented Generation (RAG) prototype used by the project.

Contents
- `health_qna.csv` - dataset used to build retrieval index (question/answer pairs).
- `rag_service.py` - RAG chain builder (`answer(question, context)`) that prefers loading persisted FAISS artifacts from `artifacts/`.
- `build_index.py` - script to build and persist FAISS index + documents to `artifacts/`.
- `rag_api.py` - a FastAPI wrapper exposing `/api/rag` and `/health` endpoints.
- `requirements.txt` - Python dependencies (transformers, langchain, faiss-cpu, sentence-transformers, fastapi, uvicorn, torch).

Quick start (local, CPU)

1. Create and activate a Python environment (recommended: 3.10+)

   python -m venv .venv
   .\.venv\Scripts\Activate.ps1  # Windows PowerShell

2. Install dependencies

   pip install -r requirements.txt

3. Build the index (recommended) for faster startup:

   python build_index.py

4. Run the FastAPI service:

   uvicorn rag_api:app --host 127.0.0.1 --port 8001 --reload

5. Point your backend to the service:

   RAG_API_URL=http://127.0.0.1:8001/api/rag

Notes
- The reader model `google/flan-t5-base` can be heavy on CPU. If you have limited resources, consider switching to `google/flan-t5-small` in `rag_service.py`.
- For production use, containerize this service, add authentication, rate limiting, and monitoring.
