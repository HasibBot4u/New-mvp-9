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

class EnrollmentRequest(BaseModel):
    code: str

@router.post("/checkout")
async def create_checkout(req: CheckoutRequest, current_user: dict = Depends(get_current_user)):
    """
    Payments are disabled.
    """
    raise HTTPException(status_code=400, detail="Payments not yet enabled. Please use an enrollment code.")

@router.post("/enroll")
async def redeem_enrollment_code(req: EnrollmentRequest, current_user: dict = Depends(get_current_user)):
    """
    Redeem an enrollment code.
    """
    valid = await payment_service.validate_enrollment_code(req.code)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid enrollment code")
        
    return {"status": "success", "message": "Enrollment successful"}
