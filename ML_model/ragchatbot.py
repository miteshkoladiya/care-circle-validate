import streamlit as st
import pandas as pd
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.vectorstores import FAISS
from langchain.llms import HuggingFacePipeline
from langchain.chains import RetrievalQA
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline

# --- Streamlit UI ---
st.set_page_config(page_title="AI Health Chatbot", layout="centered")
st.title("💬 AI-Powered Health Chatbot (RAG-based)")
st.caption("Answers generated using our pre-defined medical QnA dataset.")

# --- Load dataset ---
# Ensure your CSV file (e.g., health_qna.csv) is in the same directory
csv_path = "health_qna.csv"
df = pd.read_csv(csv_path)
df = df.fillna("")

# Combine question + focus_area + answer for context
df["combined"] = (
    "Focus area: " + df["focus_area"].astype(str) +
    " | Question: " + df["question"].astype(str) +
    " | Answer: " + df["answer"].astype(str)
)

documents = df["combined"].tolist()

# --- Load embedding model ---
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

# --- Create or load FAISS vector DB ---
with st.spinner("Building knowledge base..."):
    db = FAISS.from_texts(documents, embeddings)
    retriever = db.as_retriever(search_kwargs={"k": 3})

# --- Load generative model ---
model_name = "google/flan-t5-base"  
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
pipe = pipeline("text2text-generation", model=model, tokenizer=tokenizer, max_length=256)
llm = HuggingFacePipeline(pipeline=pipe)

# --- Create RetrievalQA chain ---
qa_chain = RetrievalQA.from_chain_type(llm=llm, retriever=retriever)

# --- Chat UI ---
user_input = st.text_input("Ask your health question:")

if user_input:
    with st.spinner("Generating response..."):
        response = qa_chain.run(user_input)
        st.markdown(f"### 🤖 Answer:\n{response}")

        # Optional: show retrieved docs for transparency
        with st.expander("🔍 Retrieved Context"):
            context = retriever.get_relevant_documents(user_input)
            for i, doc in enumerate(context, 1):
                st.markdown(f"**Doc {i}:** {doc.page_content[:400]}...")
