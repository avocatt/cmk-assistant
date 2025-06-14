import sys
import traceback
import os
import glob
import shutil
import re
from typing import List
from core.config import settings
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain.docstore.document import Document


def process_statute(docs: List[Document]) -> List[Document]:
    """
    Splits statute PDF documents based on 'Madde' (Article) boundaries.
    This preserves the integrity of each legal article as a single document.
    """
    print(f"  -> Using statute processor for {docs[0].metadata['source']}")

    # This regex is designed to find the start of an article.
    # It looks for "Madde" at the beginning of a line, followed by a number and a dash/hyphen.
    # The (?=...) is a positive lookahead, which splits the text but keeps the delimiter.
    article_pattern = re.compile(r'(?=\n\s*Madde \d+)', re.IGNORECASE)

    # First, join all page content into a single string.
    # We keep the original page docs to find page numbers later.
    full_text = "\n".join([d.page_content for d in docs])

    # Split the entire text into chunks based on the article pattern.
    text_chunks = article_pattern.split(full_text)

    articles = []
    # The first element might be a preamble before "Madde 1".
    if text_chunks[0].strip():
        preamble_metadata = docs[0].metadata.copy()
        preamble_metadata['page'] = 0  # Assume preamble is on the first pages
        articles.append(Document(
            page_content=text_chunks[0].strip(), metadata=preamble_metadata))

    # The rest of the chunks are the articles themselves.
    for i in range(1, len(text_chunks)):
        article_text = text_chunks[i].strip()
        if not article_text:
            continue

        # Find the page number for this article.
        # We search for the first few words of the article in the original page contents.
        page_number = -1
        # Use a short, unique prefix of the article to find its starting page
        search_prefix = ' '.join(article_text.split()[:5])
        for page_doc in docs:
            if search_prefix in page_doc.page_content:
                page_number = page_doc.metadata.get('page', -1)
                break  # Found the first occurrence

        metadata = docs[0].metadata.copy()  # Get base metadata like source
        metadata['page'] = page_number

        articles.append(
            Document(page_content=article_text, metadata=metadata))

    print(f"  -> Split into {len(articles)} articles.")
    return articles


def process_guidebook(docs: List[Document]) -> List[Document]:
    """
    Splits guidebook documents using a sentence-aware recursive splitting strategy.
    """
    print(f"  -> Using guidebook processor for {docs[0].metadata['source']}")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=750,   # Optimized for more focused context from the guidebook
        chunk_overlap=150,
        length_function=len,
        # Prioritize semantic breaks found in the guidebook
        separators=["\n\n\n", "\n\n", "\n", "♦", "Not:", ".", " ", ""],
        add_start_index=True,
    )
    chunks = text_splitter.split_documents(docs)
    print(f"  -> Split into {len(chunks)} chunks.")
    return chunks


def load_and_process_documents() -> List[Document]:
    """
    Loads documents from the data path and applies the appropriate
    chunking strategy based on the filename.
    """
    path = settings.data_path
    print(f"Loading documents from {path}...")
    pdf_files = glob.glob(os.path.join(path, "*.pdf"))
    if not pdf_files:
        print("No PDF files found in the data directory.")
        return []

    all_chunks = []
    for pdf_path in pdf_files:
        filename = os.path.basename(pdf_path)
        print(f"\nProcessing file: {filename}")
        loader = PyPDFLoader(pdf_path)
        docs = loader.load()

        # Add the source filename to the metadata for citation
        for doc in docs:
            doc.metadata["source"] = filename

        # --- Strategy Dispatcher ---
        if filename in ["1.5.5237.pdf", "1.5.5271.pdf"]:
            processed_chunks = process_statute(docs)
        else:
            processed_chunks = process_guidebook(docs)

        all_chunks.extend(processed_chunks)

    print(f"\nTotal processed chunks from all files: {len(all_chunks)}")
    return all_chunks


def main():
    """Main function to run the ingestion pipeline."""
    try:
        print("--- Starting Data Ingestion Process ---")
        print(f"DATA_PATH: {settings.data_path}")
        print(f"VECTOR_STORE_PATH: {settings.vector_store_path}")

        # 1. Load and process documents based on file type
        chunks = load_and_process_documents()
        if not chunks:
            print("ERROR: No document chunks were created! Exiting.")
            return

        # 2. Clear existing vector store and create a new one
        if os.path.exists(settings.vector_store_path):
            print(
                f"Removing existing vector store at {settings.vector_store_path}...")
            shutil.rmtree(settings.vector_store_path)

        print("Initializing OpenAI embeddings...")
        embedding_function = OpenAIEmbeddings(
            api_key=settings.openai_api_key
        )

        print("Creating vector database (this may take a few minutes)...")
        # Process chunks in batches to avoid OpenAI token limits
        batch_size = 100  # Process 100 chunks at a time to stay under token limits

        # Initialize empty vector store
        db = Chroma(
            embedding_function=embedding_function,
            persist_directory=settings.vector_store_path
        )

        # Process chunks in batches
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            print(
                f"Processing batch {i//batch_size + 1}/{(len(chunks) + batch_size - 1)//batch_size} ({len(batch)} chunks)...")

            # Add batch to vector store
            db.add_documents(batch)

        print("\n--- Data Ingestion Complete! ---")
        print(f"Vector store created with {db._collection.count()} vectors.")

    except Exception as e:
        print(f"FATAL ERROR during ingestion: {e}")
        print(f"Error type: {type(e).__name__}")
        print("Full traceback:")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
