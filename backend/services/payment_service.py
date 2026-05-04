from typing import Optional, Dict, Any
import uuid

class PaymentService:
    async def create_bkash_payment(self, amount: float, reference: str) -> Dict[str, Any]:
        """
        Mock implementation of bKash create payment API.
        In production, this would call bKash token & create APIs.
        """
        return {
            "paymentID": f"bkash_{uuid.uuid4().hex[:10]}",
            "bkashURL": f"https://sandbox.payment.bkash.com/redirect/token=dummy_token",
            "callbackURL": "http://localhost:8080/api/v1/payments/bkash/callback",
            "amount": amount,
            "merchantInvoiceNumber": reference
        }

    async def execute_bkash_payment(self, payment_id: str) -> Dict[str, Any]:
        """
        Mock implementation of bKash execute API.
        """
        # Assuming successful execution for the mock
        return {
            "statusCode": "0000",
            "message": "Successful",
            "paymentID": payment_id,
            "payerReference": "017XXXXXXXX",
            "customerMsisdn": "017XXXXXXXX",
            "trxID": f"TRX{uuid.uuid4().hex[:8].upper()}",
            "amount": "199.00"
        }

    async def create_stripe_checkout(self, plan_id: str, customer_email: str) -> Dict[str, Any]:
        """
        Mock implementation of Stripe Checkout Session creation.
        """
        return {
            "id": f"cs_test_{uuid.uuid4().hex}",
            "url": "https://checkout.stripe.com/pay/cs_test_dummy",
            "client_secret": "dummy_secret"
        }

payment_service = PaymentService()
