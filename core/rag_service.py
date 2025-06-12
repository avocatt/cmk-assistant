from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.schema.runnable import RunnablePassthrough
from langchain.schema.output_parser import StrOutputParser
from langchain.docstore.document import Document as LangchainDocument

from typing import List
from .config import settings
from api.models import Source

# This is your "secret sauce". The prompt is critical for getting good results.
# It should be in Turkish and instruct the AI on how to behave.
PROMPT_TEMPLATE = """
Sen, Ceza Muhakemesi Kanunu (CMK) ve Türk Ceza Kanunu (TCK) konularında uzman bir Avukatsın.
Sana verilen belge içeriklerini kullanarak kullanıcının sorusunu yanıtla.
Bilgilerin yalnızca sağlanan metinlere dayanmalıdır. Eğer cevap metinlerde yoksa, "Bu bilgiye sahip değilim." de.
Cevabını oluştururken, kullandığın metin parçalarını ve kaynaklarını (belge adı ve sayfa numarası) belirt.

Bağlam:
{context}

Soru:
{question}

Cevap:
"""


class RAGService:
    def __init__(self, retriever, answer_chain):
        self.retriever = retriever
        self.answer_chain = answer_chain

    def invoke(self, question: str) -> dict:
        # Get relevant documents
        source_documents = self.retriever.invoke(question)

        # Get answer from the chain
        answer = self.answer_chain.invoke(question)

        # Extract sources
        sources = [
            Source(
                source_document=doc.metadata.get("source", "N/A"),
                page=doc.metadata.get("page", -1),
                content=doc.page_content,
            )
            for doc in source_documents
        ]

        return {"answer": answer, "sources": sources}


def get_rag_chain():
    """
    Factory function to create and return the RAG chain.
    This should be called once at application startup.
    """
    try:
        # Use OpenAI's API directly for embeddings (OpenRouter doesn't support embedding endpoints)
        embedding_function = OpenAIEmbeddings(
            api_key=settings.openai_api_key
        )

        vector_store = Chroma(
            persist_directory=settings.vector_store_path,
            embedding_function=embedding_function
        )

        retriever = vector_store.as_retriever(
            search_kwargs={'k': 3})  # Retrieve top 3 chunks

        prompt = PromptTemplate(
            template=PROMPT_TEMPLATE,
            input_variables=["context", "question"],
        )

        # Using OpenRouter for LLM with configurable model
        llm = ChatOpenAI(
            temperature=0.1,
            model_name=settings.model_name,
            api_key=settings.openrouter_api_key,
            base_url="https://openrouter.ai/api/v1"
        )

        def format_docs(docs: List[LangchainDocument]) -> str:
            """Helper function to format retrieved documents for the prompt."""
            return "\n\n".join(f"Kaynak: {doc.metadata.get('source', 'Bilinmiyor')}, Sayfa: {doc.metadata.get('page', 'Bilinmiyor')}\nİçerik: {doc.page_content}" for doc in docs)

        rag_chain = (
            {"context": retriever | format_docs, "question": RunnablePassthrough()}
            | prompt
            | llm
            | StrOutputParser()
        )

        # Return the service with the retriever and answer chain
        return RAGService(retriever=retriever, answer_chain=rag_chain)

    except Exception as e:
        # Handle cases where the vector store might not be initialized yet
        print(f"Error initializing RAG chain: {e}")
        # In a real app, you might want to raise a more specific exception
        # that the API route can catch and return a 503 Service Unavailable.
        raise RuntimeError(
            "RAG service could not be initialized. Have you run the ingestion script? (`python scripts/ingest.py`)")
