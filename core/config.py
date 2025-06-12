import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings:
    def __init__(self):
        # For the RAG chain
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        self.model_name = os.getenv("MODEL_NAME")

        # For the audio transcription endpoint
        self.openai_api_key = os.getenv("OPENAI_API_KEY")

        self.vector_store_path = os.getenv("VECTOR_STORE_PATH", "./chroma_db")
        self.data_path = os.getenv("DATA_PATH", "./data")

        if not self.openrouter_api_key:
            raise ValueError(
                "OPENROUTER_API_KEY environment variable not set.")
        if not self.model_name:
            raise ValueError("MODEL_NAME environment variable not set.")
        if not self.openai_api_key:
            raise ValueError(
                "OPENAI_API_KEY environment variable not set for transcription endpoint.")


settings = Settings()
