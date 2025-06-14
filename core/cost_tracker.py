import time
import uuid
from typing import Dict, Optional, List
from dataclasses import dataclass, field
from datetime import datetime
import json
import asyncio
from threading import Lock


@dataclass
class APICall:
    """Represents a single API call with cost information"""
    service: str  # 'openai', 'openrouter'
    endpoint: str  # 'chat/completions', 'audio/transcriptions', etc.
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cost: float = 0.0
    timestamp: datetime = field(default_factory=datetime.utcnow)
    duration_ms: int = 0
    success: bool = True
    error_message: Optional[str] = None


@dataclass
class RequestCostSummary:
    """Summary of all API costs for a single request"""
    request_id: str
    endpoint: str
    user_ip: Optional[str] = None
    start_time: datetime = field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    api_calls: List[APICall] = field(default_factory=list)
    total_cost: float = 0.0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    success: bool = True
    error_message: Optional[str] = None

    def add_api_call(self, api_call: APICall):
        """Add an API call to this request and update totals"""
        self.api_calls.append(api_call)
        self.total_cost += api_call.cost
        self.total_input_tokens += api_call.input_tokens
        self.total_output_tokens += api_call.output_tokens
        if not api_call.success:
            self.success = False

    def finish_request(self, success: bool = True, error_message: Optional[str] = None):
        """Mark the request as finished"""
        self.end_time = datetime.utcnow()
        if not success:
            self.success = False
            self.error_message = error_message


class CostTracker:
    """
    Tracks API costs across different services and provides cost calculations
    """

    # OpenAI pricing (as of latest known rates - update these periodically)
    OPENAI_PRICING = {
        'gpt-4o': {'input': 0.0025, 'output': 0.01},  # per 1K tokens
        'gpt-4o-mini': {'input': 0.00015, 'output': 0.0006},
        'gpt-4': {'input': 0.03, 'output': 0.06},
        'gpt-3.5-turbo': {'input': 0.0015, 'output': 0.002},
        'whisper-1': {'audio': 0.006},  # per minute
        'text-embedding-3-small': {'input': 0.00002, 'output': 0},
        'text-embedding-3-large': {'input': 0.00013, 'output': 0},
        'text-embedding-ada-002': {'input': 0.0001, 'output': 0},
    }

    # OpenRouter pricing (these are approximate - OpenRouter has dynamic pricing)
    # You might want to fetch these from OpenRouter's API periodically
    OPENROUTER_PRICING = {
        'anthropic/claude-3.5-sonnet': {'input': 0.003, 'output': 0.015},
        'anthropic/claude-3-haiku': {'input': 0.00025, 'output': 0.00125},
        'openai/gpt-4o': {'input': 0.005, 'output': 0.015},
        'openai/gpt-4o-mini': {'input': 0.00015, 'output': 0.0006},
        'meta-llama/llama-3.1-8b-instruct': {'input': 0.00018, 'output': 0.00018},
        'meta-llama/llama-3.1-70b-instruct': {'input': 0.0009, 'output': 0.0009},
    }

    def __init__(self):
        self.active_requests: Dict[str, RequestCostSummary] = {}
        self.completed_requests: List[RequestCostSummary] = []
        self._lock = Lock()

    def start_request_tracking(self, endpoint: str, user_ip: Optional[str] = None) -> str:
        """Start tracking costs for a new request"""
        request_id = str(uuid.uuid4())
        with self._lock:
            self.active_requests[request_id] = RequestCostSummary(
                request_id=request_id,
                endpoint=endpoint,
                user_ip=user_ip
            )
        return request_id

    def track_openai_call(self, request_id: str, model: str, endpoint: str,
                          input_tokens: int = 0, output_tokens: int = 0,
                          audio_duration_minutes: float = 0, success: bool = True,
                          error_message: Optional[str] = None, duration_ms: int = 0) -> float:
        """Track an OpenAI API call and calculate cost"""
        cost = 0.0

        if model in self.OPENAI_PRICING:
            pricing = self.OPENAI_PRICING[model]
            if 'audio' in pricing:  # Whisper model
                cost = audio_duration_minutes * pricing['audio']
            else:  # Text models
                cost = (input_tokens / 1000.0 * pricing['input'] +
                        output_tokens / 1000.0 * pricing['output'])

        api_call = APICall(
            service='openai',
            endpoint=endpoint,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost=cost,
            duration_ms=duration_ms,
            success=success,
            error_message=error_message
        )

        with self._lock:
            if request_id in self.active_requests:
                self.active_requests[request_id].add_api_call(api_call)

        return cost

    def track_openrouter_call(self, request_id: str, model: str,
                              input_tokens: int = 0, output_tokens: int = 0,
                              success: bool = True, error_message: Optional[str] = None,
                              duration_ms: int = 0) -> float:
        """Track an OpenRouter API call and calculate cost"""
        cost = 0.0

        if model in self.OPENROUTER_PRICING:
            pricing = self.OPENROUTER_PRICING[model]
            cost = (input_tokens / 1000.0 * pricing['input'] +
                    output_tokens / 1000.0 * pricing['output'])

        api_call = APICall(
            service='openrouter',
            endpoint='chat/completions',
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost=cost,
            duration_ms=duration_ms,
            success=success,
            error_message=error_message
        )

        with self._lock:
            if request_id in self.active_requests:
                self.active_requests[request_id].add_api_call(api_call)

        return cost

    def finish_request(self, request_id: str, success: bool = True,
                       error_message: Optional[str] = None) -> Optional[RequestCostSummary]:
        """Finish tracking a request and move it to completed requests"""
        with self._lock:
            if request_id in self.active_requests:
                request_summary = self.active_requests.pop(request_id)
                request_summary.finish_request(success, error_message)
                self.completed_requests.append(request_summary)

                # Keep only last 1000 completed requests to prevent memory issues
                if len(self.completed_requests) > 1000:
                    self.completed_requests = self.completed_requests[-1000:]

                return request_summary
        return None

    def get_request_summary(self, request_id: str) -> Optional[RequestCostSummary]:
        """Get summary for a specific request"""
        with self._lock:
            if request_id in self.active_requests:
                return self.active_requests[request_id]

            for completed in self.completed_requests:
                if completed.request_id == request_id:
                    return completed
        return None

    def get_total_costs_today(self) -> Dict:
        """Get total costs for today across all services"""
        today = datetime.utcnow().date()
        today_requests = [r for r in self.completed_requests
                          if r.start_time.date() == today]

        total_cost = sum(r.total_cost for r in today_requests)
        total_input_tokens = sum(r.total_input_tokens for r in today_requests)
        total_output_tokens = sum(
            r.total_output_tokens for r in today_requests)

        service_breakdown = {}
        for request in today_requests:
            for api_call in request.api_calls:
                service = api_call.service
                if service not in service_breakdown:
                    service_breakdown[service] = {
                        'cost': 0.0, 'input_tokens': 0, 'output_tokens': 0, 'calls': 0
                    }
                service_breakdown[service]['cost'] += api_call.cost
                service_breakdown[service]['input_tokens'] += api_call.input_tokens
                service_breakdown[service]['output_tokens'] += api_call.output_tokens
                service_breakdown[service]['calls'] += 1

        return {
            'date': today.isoformat(),
            'total_cost': total_cost,
            'total_input_tokens': total_input_tokens,
            'total_output_tokens': total_output_tokens,
            'total_requests': len(today_requests),
            'service_breakdown': service_breakdown
        }

    def get_recent_requests(self, limit: int = 50) -> List[Dict]:
        """Get recent request summaries"""
        with self._lock:
            recent = sorted(self.completed_requests,
                            key=lambda x: x.start_time, reverse=True)[:limit]

            return [{
                'request_id': r.request_id,
                'endpoint': r.endpoint,
                'start_time': r.start_time.isoformat(),
                'end_time': r.end_time.isoformat() if r.end_time else None,
                'total_cost': r.total_cost,
                'total_input_tokens': r.total_input_tokens,
                'total_output_tokens': r.total_output_tokens,
                'success': r.success,
                'api_calls_count': len(r.api_calls)
            } for r in recent]


# Global cost tracker instance
cost_tracker = CostTracker()
