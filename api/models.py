from pydantic import BaseModel
from typing import List


class ChatRequest(BaseModel):
    question: str


class Source(BaseModel):
    source_document: str
    page: int
    content: str


class ChatResponse(BaseModel):
    answer: str
    sources: List[Source]
