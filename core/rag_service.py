from langchain_community.vectorstores import Chroma
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.prompts import PromptTemplate
from langchain.schema.runnable import Runnable, RunnablePassthrough
from langchain.schema.output_parser import StrOutputParser
from langchain.docstore.document import Document as LangchainDocument

from typing import List
from .config import settings
from api.models import Source

# This is your "secret sauce". The prompt is critical for getting good results.
# It should be in Turkish and instruct the AI on how to behave.
PROMPT_TEMPLATE = """
İzmir Barosu'na kayıtlı tecrübeli bir avukatsın.

ÖNEMLİ KURALLAR:
- SADECE aşağıdaki bağlam metinlerini kullan
- Kendi bilgilerini veya genel hukuk bilgilerini ASLA kullanma
- Bağlam metinlerinde olmayan hiçbir bilgiyi paylaşma
- Eğer sorulan bilgi bağlam metinlerinde yoksa, kesinlikle "Bu bilgi sağlanan belgelerde bulunmamaktadır" de
- Her cevabında kullandığın kaynak bilgilerini (belge adı ve sayfa numarası) mutlaka belirt

Bağlam Metinleri:
{context}

Kullanıcı Sorusu:
{question}

Cevap (sadece yukarıdaki bağlam metinlerini kullanarak):
"""


class RAGService:
    def __init__(self, retriever: Runnable, chain: Runnable):
        self.retriever = retriever
        self.chain = chain

    def get_source_documents(self, question: str) -> List[LangchainDocument]:
        """Retrieves source documents but does not generate an answer."""
        docs = self.retriever.invoke(question)

        # Debug: Print what documents were retrieved
        print(
            f"\n=== DEBUG: Retrieved {len(docs)} documents for question: {question[:50]}... ===")
        for i, doc in enumerate(docs):
            source = doc.metadata.get('source', 'Unknown')
            page = doc.metadata.get('page', 'Unknown')
            content_preview = doc.page_content[:100] + "..." if len(
                doc.page_content) > 100 else doc.page_content
            print(f"Doc {i+1}: {source} (Page {page}) - {content_preview}")
        print("=== END DEBUG ===\n")

        return docs

    def get_streaming_answer(self, question: str, context: str):
        """Returns a streaming generator for the LLM answer."""
        return self.chain.stream({"context": context, "question": question})

    def get_answer(self, question: str, context: str) -> str:
        """Returns a complete answer as a string."""
        return self.chain.invoke({"context": context, "question": question})

    @staticmethod
    def format_docs(docs: List[LangchainDocument]) -> str:
        """Helper function to format retrieved documents for the prompt."""
        return "\n\n".join(f"Kaynak: {doc.metadata.get('source', 'Bilinmiyor')}, Sayfa: {doc.metadata.get('page', 'Bilinmiyor')}\nİçerik: {doc.page_content}" for doc in docs)


def get_rag_chain():
    """
    Factory function to create and return the RAG chain.
    This should be called once at application startup.
    """
    try:
        # Use OpenAI's API for embeddings (same as original)
        embedding_function = OpenAIEmbeddings(
            api_key=settings.openai_api_key
        )

        vector_store = Chroma(
            persist_directory=settings.vector_store_path,
            embedding_function=embedding_function
        )

        retriever = vector_store.as_retriever(
            search_kwargs={'k': 5})  # Retrieve top 5 chunks

        prompt = PromptTemplate(
            template=PROMPT_TEMPLATE,
            input_variables=["context", "question"],
        )

        # Using OpenRouter for LLM with configurable model
        llm = ChatOpenAI(
            temperature=0.1,
            model_name=settings.model_name,
            api_key=settings.openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
            streaming=True,  # Enable streaming
        )

        rag_chain = (
            prompt
            | llm
            | StrOutputParser()
        )

        # Return the service with the retriever and the chain separated
        return RAGService(retriever=retriever, chain=rag_chain)

    except Exception as e:
        # Handle cases where the vector store might not be initialized yet
        print(f"Error initializing RAG chain: {e}")
        raise RuntimeError(
            "RAG service could not be initialized. Have you run the ingestion script? (`python scripts/ingest.py`)")
