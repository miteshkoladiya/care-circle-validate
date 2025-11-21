import os
import json
import pandas as pd
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.vectorstores import FAISS
from langchain.llms import HuggingFacePipeline
from langchain.chains import RetrievalQA
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline

# Paths
BASE_DIR = os.path.dirname(__file__)
DATA_CSV = os.path.join(BASE_DIR, 'health_qna.csv')
ARTIFACT_DIR = os.path.join(BASE_DIR, 'artifacts')
FAISS_SUBDIR = os.path.join(ARTIFACT_DIR, 'faiss_index')
DOCS_PATH = os.path.join(ARTIFACT_DIR, 'docs.json')

def _build_qa_chain():
    """Build or load the RetrievalQA chain.

    Preference order:
    1. Load persisted FAISS index and documents from ML_model/artifacts/
    2. Fall back to building from the CSV dataset (health_qna.csv)
    """
    # embeddings (small CPU-friendly model)
    embeddings = HuggingFaceEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')

    retriever = None

    # Try to load persisted artifacts first (fast)
    try:
        if os.path.exists(ARTIFACT_DIR) and os.path.exists(FAISS_SUBDIR) and os.path.exists(DOCS_PATH):
            with open(DOCS_PATH, 'r', encoding='utf-8') as f:
                documents = json.load(f)

            if documents:
                db = FAISS.load_local(FAISS_SUBDIR, embeddings)
                retriever = db.as_retriever(search_kwargs={'k': 2})
                print('Loaded FAISS index and documents from', ARTIFACT_DIR)
    except Exception as e:
        print('Failed to load persisted artifacts, will try to rebuild. Error:', e)

    # If no retriever from artifacts, try to build from CSV
    if retriever is None:
        documents = []
        if os.path.exists(DATA_CSV):
            df = pd.read_csv(DATA_CSV).fillna('')
            df['combined'] = (
                'Focus area: ' + df['focus_area'].astype(str) +
                ' | Question: ' + df['question'].astype(str) +
                ' | Answer: ' + df['answer'].astype(str)
            )
            documents = df['combined'].tolist()

        if documents:
            try:
                db = FAISS.from_texts(documents, embeddings)
                retriever = db.as_retriever(search_kwargs={'k': 2})
                # Optionally persist the newly built index for faster restarts
                try:
                    os.makedirs(ARTIFACT_DIR, exist_ok=True)
                    db.save_local(FAISS_SUBDIR)
                    with open(DOCS_PATH, 'w', encoding='utf-8') as f:
                        json.dump(documents, f)
                    print('Built and saved FAISS artifacts to', ARTIFACT_DIR)
                except Exception as e:
                    print('Failed to save artifacts (non-fatal):', e)
            except Exception as e:
                print('Failed to build FAISS index from documents:', e)

    # If still no retriever, the QA chain cannot be created
    if retriever is None:
        print('No retriever available; QA chain will not be created.')

    # generative model (may be heavy)
    # Use a smaller/flan model by default for faster local dev. Swap to flan-t5-base for higher quality.
    model_name = 'google/flan-t5-small'
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
    pipe = pipeline('text2text-generation', model=model, tokenizer=tokenizer, max_length=128)
    llm = HuggingFacePipeline(pipeline=pipe)

    qa_chain = RetrievalQA.from_chain_type(llm=llm, retriever=retriever) if retriever is not None else None
    return qa_chain


# Build chain at import time (slow on first import)
_QA_CHAIN = None
try:
    _QA_CHAIN = _build_qa_chain()
except Exception as e:
    print('Failed to build QA chain:', e)
    _QA_CHAIN = None


def answer(question: str, context: list = None):
    """Return an answer string for the given question using the RAG chain.

    If the chain failed to build, returns a fallback message.
    """
    # Try to ensure the QA chain is available; attempt a rebuild on demand.
    global _QA_CHAIN
    if not _QA_CHAIN:
        try:
            print('QA chain missing on request; attempting to rebuild...')
            _QA_CHAIN = _build_qa_chain()
        except Exception as e:
            print('Rebuild attempt failed:', e)

    if not _QA_CHAIN:
        # Return a safe, user-friendly fallback instead of raising so callers
        # (FastAPI wrapper / backend) receive a graceful response.
        print('RAG chain not available; returning fallback answer')
        return 'RAG service is temporarily unavailable. Please try again later.'

    try:
        return _QA_CHAIN.run(question)
    except Exception as e:
        # Log the error and return a fallback answer so the API doesn't 500.
        print('RAG run failed:', repr(e))
        return 'RAG failed to generate an answer. Please try again later.'


def is_ready():
    """Return True if the QA chain is loaded and ready to answer."""
    return _QA_CHAIN is not None
