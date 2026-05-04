import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock

from fastapi import HTTPException, Request, status


IDENTIFIER_MAX_LENGTH = 320


class IpRateLimiter:
    def __init__(self, max_requests: int, window: timedelta):
        self._max_requests = max_requests
        self._window = window
        self._buckets: dict[str, list[datetime]] = defaultdict(list)
        self._lock = Lock()

    def check(self, request: Request) -> None:
        ip = self._get_client_ip(request)
        now = datetime.now(timezone.utc)
        window_start = now - self._window

        with self._lock:
            timestamps = self._buckets[ip]
            timestamps[:] = [t for t in timestamps if t > window_start]

            if len(timestamps) >= self._max_requests:
                oldest_in_window = min(timestamps)
                retry_after = math.ceil((oldest_in_window + self._window - now).total_seconds())
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Try again later.",
                    headers={"Retry-After": str(max(1, retry_after))},
                )

            timestamps.append(now)

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Take the rightmost non-empty IP — it's appended by our proxy (Railway)
            # and cannot be forged by the client (unlike leftmost values).
            ips = [ip.strip() for ip in forwarded_for.split(",")]
            rightmost = next((ip for ip in reversed(ips) if ip), None)
            if rightmost:
                return rightmost[:IDENTIFIER_MAX_LENGTH]

        if request.client is not None and request.client.host:
            return request.client.host[:IDENTIFIER_MAX_LENGTH]

        return "unknown"
