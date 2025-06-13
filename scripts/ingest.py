import sys
import traceback
import os
import glob
import shutil
from typing import List
from core.config import settings
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain.docstore.document import Document


def load_documents(path: str) -> List[Document]:
    """Loads all PDF documents from the specified directory."""
    print(f"Loading documents from {path}...")
    pdf_files = glob.glob(os.path.join(path, "*.pdf"))
    if not pdf_files:
        print("No PDF files found in the data directory.")
        return []

    all_docs = []
    for pdf_path in pdf_files:
        loader = PyPDFLoader(pdf_path)
        docs = loader.load()
        # Add the source filename to the metadata for citation
        for doc in docs:
            doc.metadata["source"] = os.path.basename(pdf_path)
        all_docs.extend(docs)
    print(f"Loaded {len(all_docs)} pages from {len(pdf_files)} PDF files.")
    return all_docs


def split_documents(docs: List[Document]) -> List[Document]:
    """Splits documents into smaller chunks for processing."""
    print("Splitting documents into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
    )
    chunks = text_splitter.split_documents(docs)
    print(f"Split documents into {len(chunks)} chunks.")
    return chunks


def main():
    """Main function to run the ingestion pipeline."""
    try:
        print("Starting data ingestion process...")
        print(f"Environment check:")
        print(f"  DATA_PATH: {settings.data_path}")
        print(f"  VECTOR_STORE_PATH: {settings.vector_store_path}")
        print(
            f"  OPENAI_API_KEY: {'SET' if settings.openai_api_key else 'NOT SET'}")

        # 1. Load documents
        documents = load_documents(settings.data_path)
        if not documents:
            print("ERROR: No documents found! Exiting.")
            return

        # 2. Split documents
        chunks = split_documents(documents)

        # 3. Clear existing vector store and create new one
        print(f"Creating vector store at {settings.vector_store_path}...")

        # Remove existing vector store if it exists to avoid duplicates
        if os.path.exists(settings.vector_store_path):
            print(
                f"Removing existing vector store at {settings.vector_store_path}...")
            shutil.rmtree(settings.vector_store_path)

        # Use OpenAI's API directly for embeddings (OpenRouter doesn't support embedding endpoints)
        print("Initializing OpenAI embeddings...")
        embedding_function = OpenAIEmbeddings(
            api_key=settings.openai_api_key
        )

        # The `from_documents` method handles embedding and storing in one step.
        # It will create the directory if it doesn't exist and persist the data.
        print("Creating vector database (this may take a few minutes)...")
        db = Chroma.from_documents(
            chunks,
            embedding_function,
            persist_directory=settings.vector_store_path
        )

        print("Data ingestion complete!")
        print(f"Vector store created with {db._collection.count()} vectors.")

    except Exception as e:
        print(f"FATAL ERROR during ingestion: {e}")
        print(f"Error type: {type(e).__name__}")
        print("Full traceback:")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
