"""Unit tests for the Stage 2 HMAC stream-ticket mechanism."""
import time

from backend.main import generate_stream_ticket, verify_stream_ticket


def test_ticket_roundtrip():
    ticket, ttl = generate_stream_ticket("user-abc", "video-1")
    assert ttl == 6 * 3600
    assert verify_stream_ticket("video-1", ticket) == "user-abc"


def test_ticket_bound_to_video():
    ticket, _ = generate_stream_ticket("user-abc", "video-1")
    # Same ticket must not work for a different video
    assert verify_stream_ticket("video-2", ticket) is None


def test_ticket_tampering_rejected():
    ticket, _ = generate_stream_ticket("user-abc", "video-1")
    user, exp, sig = ticket.split(":", 2)
    forged = f"attacker:{exp}:{sig}"
    assert verify_stream_ticket("video-1", forged) is None


def test_ticket_expiry_rejected():
    ticket, _ = generate_stream_ticket("user-abc", "video-1")
    user, exp, sig = ticket.split(":", 2)
    expired = f"{user}:{int(time.time()) - 10}:{sig}"
    assert verify_stream_ticket("video-1", expired) is None


def test_ticket_malformed_rejected():
    assert verify_stream_ticket("video-1", "garbage") is None
    assert verify_stream_ticket("video-1", "") is None
