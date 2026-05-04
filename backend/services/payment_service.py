from typing import Optional, Dict, Any
import uuid

class PaymentService:
    # Payment gateways to be added when budget available

    async def validate_enrollment_code(self, code: str) -> bool:
        """
        Validate an enrollment code.
        """
        # Simple mock or DB check for enrollment code
        return len(code) >= 6

payment_service = PaymentService()
