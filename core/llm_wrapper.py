from langchain_openai import ChatOpenAI
from langchain.callbacks.base import BaseCallbackHandler
from langchain.schema import LLMResult, BaseMessage
from typing import Dict, List, Any, Optional
import time
from .cost_tracker import cost_tracker


class CostTrackingCallback(BaseCallbackHandler):
    """Callback handler to track LLM costs and token usage"""

    def __init__(self, request_id: str, model_name: str, service: str = "openrouter"):
        self.request_id = request_id
        self.model_name = model_name
        self.service = service
        self.start_time = None

    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs) -> None:
        """Called when LLM starts processing"""
        self.start_time = time.time()

    def on_llm_end(self, response: LLMResult, **kwargs) -> None:
        """Called when LLM finishes processing"""
        if self.start_time is None:
            return

        duration_ms = int((time.time() - self.start_time) * 1000)

        # Extract token usage from the response
        total_input_tokens = 0
        total_output_tokens = 0

        if response.llm_output and 'token_usage' in response.llm_output:
            token_usage = response.llm_output['token_usage']
            total_input_tokens = token_usage.get('prompt_tokens', 0)
            total_output_tokens = token_usage.get('completion_tokens', 0)

        # Track the cost
        if self.service == "openrouter":
            cost_tracker.track_openrouter_call(
                request_id=self.request_id,
                model=self.model_name,
                input_tokens=total_input_tokens,
                output_tokens=total_output_tokens,
                success=True,
                duration_ms=duration_ms
            )
        elif self.service == "openai":
            cost_tracker.track_openai_call(
                request_id=self.request_id,
                model=self.model_name,
                endpoint="chat/completions",
                input_tokens=total_input_tokens,
                output_tokens=total_output_tokens,
                success=True,
                duration_ms=duration_ms
            )

    def on_llm_error(self, error: Exception, **kwargs) -> None:
        """Called when LLM encounters an error"""
        if self.start_time is None:
            return

        duration_ms = int((time.time() - self.start_time) * 1000)

        if self.service == "openrouter":
            cost_tracker.track_openrouter_call(
                request_id=self.request_id,
                model=self.model_name,
                success=False,
                error_message=str(error),
                duration_ms=duration_ms
            )
        elif self.service == "openai":
            cost_tracker.track_openai_call(
                request_id=self.request_id,
                model=self.model_name,
                endpoint="chat/completions",
                success=False,
                error_message=str(error),
                duration_ms=duration_ms
            )


class CostTrackingChatOpenAI(ChatOpenAI):
    """Extended ChatOpenAI that automatically tracks costs"""

    def __init__(self, request_id: str = None, **kwargs):
        super().__init__(**kwargs)
        self.request_id = request_id

        # Determine service based on base_url
        service = "openai"
        if hasattr(self, 'openai_api_base') and self.openai_api_base:
            if "openrouter" in self.openai_api_base:
                service = "openrouter"
        elif hasattr(self, 'base_url') and self.base_url:
            if "openrouter" in self.base_url:
                service = "openrouter"

        # Add cost tracking callback if request_id is provided
        if self.request_id:
            callback = CostTrackingCallback(
                request_id=self.request_id,
                model_name=self.model_name,
                service=service
            )
            if hasattr(self, 'callbacks') and self.callbacks:
                self.callbacks.append(callback)
            else:
                self.callbacks = [callback]

    def with_request_id(self, request_id: str) -> 'CostTrackingChatOpenAI':
        """Create a new instance with the specified request_id for cost tracking"""
        new_instance = CostTrackingChatOpenAI(
            request_id=request_id,
            model_name=self.model_name,
            api_key=self.openai_api_key,
            base_url=getattr(self, 'base_url', None) or getattr(
                self, 'openai_api_base', None),
            temperature=self.temperature,
            streaming=getattr(self, 'streaming', False),
            **{k: v for k, v in self.__dict__.items()
               if k not in ['request_id', 'callbacks', 'model_name', 'openai_api_key', 'temperature']}
        )
        return new_instance
