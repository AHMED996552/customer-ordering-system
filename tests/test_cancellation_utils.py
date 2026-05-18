import pytest
from datetime import datetime, timezone, timedelta

# Note: The actual import paths would depend on your specific project structure.
# For these unit tests, we assume a Service/Model layer logic function:
# `validate_cancellation_eligibility(status, created_at, current_time)`
# that raises exceptions with specific error codes.

class CancellationError(Exception):
    def __init__(self, code, message):
        self.code = code
        self.message = message


def validate_cancellation_eligibility(status: str, created_at: datetime, current_time: datetime):
    """Mock representation of the target Service/Model layer logic."""
    if status == 'ACCEPTED':
        raise CancellationError('ORDER_ALREADY_ACCEPTED', 'Order already accepted')
    elif status in ['IN_PREPARATION', 'OUT_FOR_DELIVERY', 'DELIVERED']:
        raise CancellationError('ORDER_NOT_CANCELLABLE', 'Order no longer eligible')
    elif status == 'CANCELLED':
        raise CancellationError('ORDER_ALREADY_CANCELLED', 'Order already cancelled')
    elif status != 'PENDING':
        raise ValueError("Unknown status")
        
    elapsed_seconds = (current_time - created_at).total_seconds()
    if elapsed_seconds > 180:
        raise CancellationError('CANCELLATION_WINDOW_EXPIRED', 'Window closed')
        
    return True


@pytest.fixture
def base_created_at():
    return datetime(2026, 5, 10, 14, 32, 0, tzinfo=timezone.utc)


class TestCancellationUtils:
    
    @pytest.mark.parametrize("status, expected_error_code", [
        ("ACCEPTED", "ORDER_ALREADY_ACCEPTED"),
        ("IN_PREPARATION", "ORDER_NOT_CANCELLABLE"),
        ("OUT_FOR_DELIVERY", "ORDER_NOT_CANCELLABLE"),
        ("DELIVERED", "ORDER_NOT_CANCELLABLE"),
        ("CANCELLED", "ORDER_ALREADY_CANCELLED"),
    ])
    def test_status_guard_blocks_non_pending_orders(self, status, expected_error_code, base_created_at):
        """
        Covers: Guard 1 — Status Guard (evaluated first)
        Ensures that any status other than PENDING raises the exact error code specified in the contract.
        """
        current_time = base_created_at + timedelta(seconds=60) # Well within window
        
        with pytest.raises(CancellationError) as exc_info:
            validate_cancellation_eligibility(status, base_created_at, current_time)
            
        assert exc_info.value.code == expected_error_code

    @pytest.mark.parametrize("elapsed_seconds, expected_success, expected_error_code", [
        (179, True, None),
        (180, True, None),
        (181, False, "CANCELLATION_WINDOW_EXPIRED"),
        (300, False, "CANCELLATION_WINDOW_EXPIRED"),
    ])
    def test_time_window_guard_enforces_180_second_limit(self, elapsed_seconds, expected_success, expected_error_code, base_created_at):
        """
        Covers: Guard 2 — Time-Window Guard
        Tests boundary conditions strictly using mocked elapsed times. 
        Covers 179s, exactly 180s (inclusive), 181s, and well past the window (300s).
        """
        current_time = base_created_at + timedelta(seconds=elapsed_seconds)
        status = "PENDING"
        
        if expected_success:
            result = validate_cancellation_eligibility(status, base_created_at, current_time)
            assert result is True
        else:
            with pytest.raises(CancellationError) as exc_info:
                validate_cancellation_eligibility(status, base_created_at, current_time)
            
            assert exc_info.value.code == expected_error_code
