import os
import json
import pandas as pd
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.vectorstores import FAISS

ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), 'artifacts')
os.makedirs(ARTIFACT_DIR, exist_ok=True)

CSV = os.path.join(os.path.dirname(__file__), 'health_qna.csv')

def build():
    if not os.path.exists(CSV):
        print('Dataset not found:', CSV)
        return
    df = pd.read_csv(CSV).fillna('')
    df['combined'] = (
        'Focus area: ' + df['focus_area'].astype(str) +
        ' | Question: ' + df['question'].astype(str) +
        ' | Answer: ' + df['answer'].astype(str)
    )
    documents = df['combined'].tolist()

    embeddings = HuggingFaceEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')
    db = FAISS.from_texts(documents, embeddings)

    faiss_path = os.path.join(ARTIFACT_DIR, 'faiss_index')
    db.save_local(faiss_path)

    docs_path = os.path.join(ARTIFACT_DIR, 'docs.json')
    with open(docs_path, 'w', encoding='utf-8') as f:
        json.dump(documents, f)

    print('Built artifacts at', ARTIFACT_DIR)

if __name__ == '__main__':
    build()
