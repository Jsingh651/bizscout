"""
Encode/decode integer DB IDs to opaque hash strings for use in URLs.
This prevents IDOR attacks where users enumerate sequential IDs.
"""
import os
from typing import Optional
from hashids import Hashids

_hashids = Hashids(
    salt    = os.getenv("HASHIDS_SALT", "bizscout-default-salt-change-in-prod"),
    min_length = 8,
    alphabet   = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
)

def encode_id(pk: int) -> str:
    """Encode an integer primary key to a URL-safe hash string."""
    return _hashids.encode(pk)

def decode_id(hid: str) -> Optional[int]:
    """Decode a hash string back to an integer primary key. Returns None if invalid."""
    try:
        result = _hashids.decode(hid)
        return result[0] if result else None
    except Exception:
        return None
