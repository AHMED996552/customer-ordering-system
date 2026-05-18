def decode_session_cookie(session_token):
    """
    Decodes the server-side HTTP-only session cookie to resolve user identity.
    In production, this would verify a token against a session store or decode a JWT.
    For testing purposes, this function is patched by conftest.py.
    """
    if not session_token:
        return None
    # In production, actual decoding logic goes here.
    return None
