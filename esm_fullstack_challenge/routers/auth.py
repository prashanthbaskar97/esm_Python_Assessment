from datetime import datetime, timedelta
from typing import Optional
import jwt
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

auth_router = APIRouter()
security = HTTPBearer()
logger = logging.getLogger(__name__)

# Configuration
JWT_SECRET = "f1-dashboard-secret-key"
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

USERS_DB = {
    "admin": {
        "id": 1,
        "username": "admin", 
        "password": "admin123",
        "email": "admin@f1dashboard.com",
        "full_name": "F1 Admin"
    },
    "user": {
        "id": 2,
        "username": "user",
        "password": "user123", 
        "email": "user@f1dashboard.com", 
        "full_name": "F1 User"
    }
}

class LoginRequest(BaseModel):
    username: str
    password: str

@auth_router.post("/login")
def login(credentials: LoginRequest):
    """Enhanced login with comprehensive error handling"""
    try:
        # Input validation
        if not credentials.username or not credentials.password:
            logger.warning("Login attempt with missing credentials")
            raise HTTPException(
                status_code=400,
                detail="Username and password are required"
            )
        
        # Find user
        user = USERS_DB.get(credentials.username.lower().strip())
        if not user:
            logger.warning(f"Login attempt with invalid username: {credentials.username}")
            raise HTTPException(
                status_code=401,
                detail="Invalid username or password"
            )
        
        # Verify password
        if user["password"] != credentials.password:
            logger.warning(f"Invalid password attempt for user: {credentials.username}")
            raise HTTPException(
                status_code=401,
                detail="Invalid username or password"
            )
        
        # Create token
        token_data = {"sub": user["username"], "user_id": user["id"]}
        access_token = create_access_token(token_data)
        
        # Prepare response
        user_info = {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "full_name": user["full_name"]
        }
        
        logger.info(f"Successful login for user: {user['username']}")
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_info
        }
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        logger.error(f"Unexpected error during login: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during authentication"
        )

def create_access_token(data: dict) -> str:
    """Generate JWT token with error handling"""
    try:
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
        to_encode.update({"exp": expire})
        
        encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return encoded_jwt
    except Exception as e:
        logger.error(f"Error creating access token: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create authentication token"
        )

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Enhanced token verification with detailed error messages"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        
        if username is None:
            logger.warning("Token missing username claim")
            raise HTTPException(status_code=401, detail="Invalid token format")
            
        if username not in USERS_DB:
            logger.warning(f"Token for non-existent user: {username}")
            raise HTTPException(status_code=401, detail="User no longer exists")
            
        return {"username": username}
        
    except jwt.ExpiredSignatureError:
        logger.warning("Expired token used")
        raise HTTPException(status_code=401, detail="Token has expired - please log in again")
    except jwt.InvalidTokenError:
        logger.warning("Invalid token format")
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    except Exception as e:
        logger.error(f"Unexpected error during token verification: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication verification failed")

@auth_router.post("/logout")
def logout():
    """Enhanced logout with logging"""
    try:
        logger.info("User logout successful")
        return {"message": "Successfully logged out"}
    except Exception as e:
        logger.error(f"Error during logout: {str(e)}")
        # Don't fail logout even if logging fails
        return {"message": "Logged out"}