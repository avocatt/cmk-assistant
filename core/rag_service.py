from langchain_community.vectorstores import Chroma
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.prompts import PromptTemplate
from langchain.schema.runnable import Runnable, RunnablePassthrough
from langchain.schema.output_parser import StrOutputParser
from langchain.docstore.document import Document as LangchainDocument

from typing import List, Optional
from .config import settings
from .llm_wrapper import CostTrackingChatOpenAI
from .cost_tracker import cost_tracker
from api.models import Source

# This is your "secret sauce". The prompt is critical for getting good results.
# It should be in Turkish and instruct the AI on how to behave.
PROMPT_TEMPLATE = """
<Sistem_Rolü>
Sen, CMK Asistanı adında, İzmir Barosu'na kayıtlı, ceza muhakemesi alanında uzman ve tecrübeli bir avukatsın. Görevin, kullanıcının sorduğu soruları, SADECE sana sunulan bağlam metinlerini kullanarak profesyonel, net ve direkt bir dille yanıtlamaktır.
</Sistem_Rolü>

<Düşünce_Zinciri_ve_Kurallar>
1.  **Soruyu Anla:** Kullanıcının sorusunu dikkatlice analiz et.
2.  **Bağlamı Tara:** YALNIZCA `<BAĞLAM>` etiketleri içindeki metinleri kullanarak sorunun cevabını ara. Dışarıdan veya kendi eğitim verinden ASLA bilgi kullanma.
3.  **Cevap Oluşturma:**
    a. Eğer cevap bağlam metinlerinde mevcutsa, cevabı bu metinlerden çıkardığın bilgilerle, profesyonel bir dille sentezle.
    b. Cevabındaki HER bir iddiayı veya bilgiyi, kullandığın metnin geçtiği belge ve sayfa numarasını belirterek `[Belge Adı, Sayfa X]` formatında kaynak göstererek destekle. Bir cümle birden fazla kaynaktan geliyorsa, `[Belge Adı 1, Sayfa X], [Belge Adı 2, Sayfa Y]` şeklinde belirt.
    c. Eğer cevap bağlam metinlerinde KESİNLİKLE yoksa, başka hiçbir şey yazmadan SADECE "Bu bilgi sağlanan belgelerde bulunmamaktadır." yanıtını ver.
4.  **Son Kontrol:** Cevabını vermeden önce, bağlam dışı hiçbir bilgi içermediğinden ve tüm iddiaların kaynak gösterdiğinden emin ol.
</Düşünce_Zinciri_ve_Kurallar>

<Örnekler>
<Örnek_1>
<SORU>Dosyada kısıtlama kararı varsa hangi belgelere ulaşabilirim?</SORU>
<CEVAP>
Dosyada kısıtlama kararı bulunsa dahi, yakalanan kişinin veya şüphelinin ifadesini içeren tutanaklar ile bilirkişi raporları gibi belgelere erişiminiz kısıtlanamaz [İzmir Barosu CMK El Kitabı, Sayfa 27]. Bu belgeler, kısıtlama kararından etkilenmeyen ve her durumda incelenebilecek olan temel dokümanlardır [İzmir Barosu CMK El Kitabı, Sayfa 27].
</CEVAP>
</Örnek_1>
<Örnek_2>
<SORU>Avukatların yıllık zorunlu tatil süresi ne kadardır?</SORU>
<CEVAP>
Bu bilgi sağlanan belgelerde bulunmamaktadır.
</CEVAP>
</Örnek_2>
</Örnekler>

<BAĞLAM>
{context}
</BAĞLAM>

<SORU>
{question}
</SORU>

<CEVAP>
"""


class RAGService:
    def __init__(self, retriever: Runnable, chain: Runnable, llm: ChatOpenAI):
        self.retriever = retriever
        self.chain = chain
        self.llm = llm

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

    def get_streaming_answer(self, question: str, context: str, request_id: Optional[str] = None):
        """Returns a streaming generator for the LLM answer."""
        if request_id and isinstance(self.llm, CostTrackingChatOpenAI):
            # Create a new chain with cost tracking for this request
            llm_with_tracking = self.llm.with_request_id(request_id)
            prompt = PromptTemplate(
                template=PROMPT_TEMPLATE,
                input_variables=["context", "question"],
            )
            tracked_chain = prompt | llm_with_tracking | StrOutputParser()
            return tracked_chain.stream({"context": context, "question": question})
        else:
            return self.chain.stream({"context": context, "question": question})

    def get_answer(self, question: str, context: str, request_id: Optional[str] = None) -> str:
        """Returns a complete answer as a string."""
        if request_id and isinstance(self.llm, CostTrackingChatOpenAI):
            # Create a new chain with cost tracking for this request
            llm_with_tracking = self.llm.with_request_id(request_id)
            prompt = PromptTemplate(
                template=PROMPT_TEMPLATE,
                input_variables=["context", "question"],
            )
            tracked_chain = prompt | llm_with_tracking | StrOutputParser()
            return tracked_chain.invoke({"context": context, "question": question})
        else:
            return self.chain.invoke({"context": context, "question": question})

    def track_embedding_cost(self, request_id: str, text_length: int):
        """Track the cost of embedding generation for retrieval"""
        if request_id:
            # Estimate tokens (rough approximation: 1 token ≈ 4 characters)
            estimated_tokens = text_length // 4
            cost_tracker.track_openai_call(
                request_id=request_id,
                model="text-embedding-ada-002",  # Default embedding model
                endpoint="embeddings",
                input_tokens=estimated_tokens,
                output_tokens=0,
                success=True
            )

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
        llm = CostTrackingChatOpenAI(
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
        return RAGService(retriever=retriever, chain=rag_chain, llm=llm)

    except Exception as e:
        # Handle cases where the vector store might not be initialized yet
        print(f"Error initializing RAG chain: {e}")
        raise RuntimeError(
            "RAG service could not be initialized. Have you run the ingestion script? (`python scripts/ingest.py`)")
