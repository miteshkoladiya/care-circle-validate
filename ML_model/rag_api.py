# Minimal FastAPI wrapper for ragchatbot.py
# Usage: python -m uvicorn rag_api:app --reload --port 9000

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import asyncio
from concurrent.futures import ThreadPoolExecutor

app = FastAPI()

# Simple request/response models
class AskRequest(BaseModel):
    question: str
    community: Optional[str] = None
    contextPosts: Optional[List[dict]] = None
    user: Optional[dict] = None

class AskResponse(BaseModel):
    answer: str

# Import the RAG service (should export answer(question, context))
try:
    from rag_service import answer as rag_answer, is_ready as rag_is_ready
except Exception as e:
    rag_answer = None
    print('Could not import rag_service.answer:', e)

# ThreadPool for running blocking model work without blocking the event loop
_executor = ThreadPoolExecutor(max_workers=2)


@app.get('/health')
async def health():
    ready = False
    try:
        ready = bool(rag_is_ready()) if 'rag_is_ready' in globals() and rag_is_ready is not None else (rag_answer is not None)
    except Exception:
        ready = False
    return { 'status': 'ok', 'rag_available': ready }


@app.post('/api/rag', response_model=AskResponse)
async def rag_endpoint(req: AskRequest):
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail='Question required')
    if rag_answer is None:
        # Service not available
        raise HTTPException(status_code=503, detail='RAG service not available')

    loop = asyncio.get_event_loop()
    try:
        # run blocking answer() in threadpool
        result = await loop.run_in_executor(_executor, lambda: rag_answer(req.question, context=req.contextPosts or []))
    except Exception as e:
        # Surface the error message in the logs for debugging
        print('Error while answering question:', repr(e))
        raise HTTPException(status_code=500, detail='Internal RAG error: ' + str(e))

    return { 'answer': str(result) }
