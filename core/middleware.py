from fastapi import Request, Response
from fastapi.middleware.base import BaseHTTPMiddleware
from typing import Callable
import time
from .cost_tracker import cost_tracker


class CostTrackingMiddleware(BaseHTTPMiddleware):
    """Middleware to track API costs for each request"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip cost tracking for health checks and static files
        if request.url.path in ["/", "/health", "/docs", "/openapi.json"] or request.url.path.startswith("/static"):
            return await call_next(request)

        # Start tracking this request
        user_ip = request.client.host if request.client else None
        request_id = cost_tracker.start_request_tracking(
            endpoint=request.url.path,
            user_ip=user_ip
        )

        # Add request_id to request state so routes can access it
        request.state.cost_tracking_id = request_id

        start_time = time.time()
        success = True
        error_message = None

        try:
            response = await call_next(request)

            # Check if response indicates an error
            if response.status_code >= 400:
                success = False
                error_message = f"HTTP {response.status_code}"

            return response

        except Exception as e:
            success = False
            error_message = str(e)
            raise

        finally:
            # Finish tracking the request
            end_time = time.time()
            duration_ms = int((end_time - start_time) * 1000)

            request_summary = cost_tracker.finish_request(
                request_id,
                success=success,
                error_message=error_message
            )

            # Log the cost summary
            if request_summary:
                print(f"\n=== REQUEST COST SUMMARY ===")
                print(f"Request ID: {request_summary.request_id}")
                print(f"Endpoint: {request_summary.endpoint}")
                print(f"Duration: {duration_ms}ms")
                print(f"Total Cost: ${request_summary.total_cost:.6f}")
                print(f"Input Tokens: {request_summary.total_input_tokens}")
                print(f"Output Tokens: {request_summary.total_output_tokens}")
                print(f"API Calls: {len(request_summary.api_calls)}")

                for i, api_call in enumerate(request_summary.api_calls):
                    print(
                        f"  Call {i+1}: {api_call.service}/{api_call.model} - ${api_call.cost:.6f}")

                print(f"Success: {request_summary.success}")
                if not request_summary.success and request_summary.error_message:
                    print(f"Error: {request_summary.error_message}")
                print("=== END COST SUMMARY ===\n")
