from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Dict, Any
from pydantic import BaseModel
from backend.services.payment_service import payment_service
# assuming deps provides get_current_user
from backend.api.deps import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])

class CheckoutRequest(BaseModel):
    plan_id: str
    payment_method: str

@router.post("/checkout")
async def create_checkout(req: CheckoutRequest, current_user: dict = Depends(get_current_user)):
    """
    Unified checkout endpoint for all payment gateways.
    """
    # Assuming amount lookup logic based on plan_id is implemented here
    plan_prices = {
        "basic": 199.00,
        "standard": 349.00,
        "premium": 499.00,
        "lifetime": 4999.00
    }
    
    amount = plan_prices.get(req.plan_id.lower(), 199.00)
    
    if req.payment_method == "bkash":
        res = await payment_service.create_bkash_payment(amount, str(current_user.get("sub", "user_123")))
        return {"gateway": "bkash", "url": res["bkashURL"], "payment_id": res["paymentID"]}
    elif req.payment_method == "stripe":
        res = await payment_service.create_stripe_checkout(req.plan_id, current_user.get("email", "test@example.com"))
        return {"gateway": "stripe", "url": res["url"], "session_id": res["id"]}
    else:
        raise HTTPException(status_code=400, detail="Unsupported payment method")

@router.post("/bkash/callback")
async def bkash_callback(request: Request):
    """
    Webhook callback for bKash.
    """
    data = await request.json()
    payment_id = data.get("paymentID")
    
    if payment_id:
        # execute payment
        result = await payment_service.execute_bkash_payment(payment_id)
        if result.get("statusCode") == "0000":
            # Update database via supabase
            return {"status": "success", "trxID": result.get("trxID")}
        return {"status": "failed", "message": result.get("message")}
    
    raise HTTPException(status_code=400, detail="Invalid bKash request")
