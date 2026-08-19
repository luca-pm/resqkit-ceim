"""
In-memory pub/sub for live-watching a session's event log.

Backs the ISU dashboard demo: a spectator (the dashboard, watching by join
code) subscribes to a session and receives every event the instant it's
appended, without polling. Single-process dev deployment, so an in-memory
dict of queues is correct and sufficient - a multi-worker/production
deployment would need a shared broker (e.g. Redis pub/sub) instead, since
subscribers and publishers could then live in different processes.
"""

import asyncio
import logging
from collections import defaultdict
from typing import Any, Dict, Set

logger = logging.getLogger(__name__)

_subscribers: Dict[str, Set["asyncio.Queue[Any]"]] = defaultdict(set)


def subscribe(session_id: str) -> "asyncio.Queue[Any]":
    queue: "asyncio.Queue[Any]" = asyncio.Queue()
    _subscribers[session_id].add(queue)
    return queue


def unsubscribe(session_id: str, queue: "asyncio.Queue[Any]") -> None:
    _subscribers[session_id].discard(queue)
    if not _subscribers[session_id]:
        _subscribers.pop(session_id, None)


def publish(session_id: str, event: Any) -> None:
    for queue in _subscribers.get(session_id, ()):
        queue.put_nowait(event)
