from datetime import datetime, timedelta
from typing import Optional
import jwt
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from esm_fullstack_challenge.dependencies import get_db
from esm_fullstack_challenge.db import DB

auth_router = APIRouter()
security = HTTPBearer()
logger = logging.getLogger(__name__)

# Configuration
JWT_SECRET = "f1-dashboard-secret-key"
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

class LoginRequest(BaseModel):
    username: str
    password: str

def get_user_from_db(username: str, db: DB):
    """Get user from database"""
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, username, email, full_name, role, password 
                FROM users 
                WHERE username = ?
            """, (username,))
            
            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "username": row[1],
                    "email": row[2],
                    "full_name": row[3],
                    "role": row[4],
                    "password": row[5]
                }
            return None
    except Exception as e:
        logger.error(f"Database error getting user: {str(e)}")
        return None

def get_user_by_username(username: str, db: DB):
    """Helper to get user by username from database or fallback"""
    # Try database first
    user = get_user_from_db(username, db)
    if user:
        return user
    
    # Fallback to static users
    FALLBACK_USERS = {
        "admin": {
            "id": 999,
            "username": "admin", 
            "email": "admin@f1dashboard.com",
            "full_name": "F1 Administrator",
            "role": "admin"
        },
        "user": {
            "id": 998,
            "username": "user",
            "email": "user@f1dashboard.com", 
            "full_name": "F1 User",
            "role": "user"
        },
        "test": {
            "id": 997,
            "username": "test",
            "email": "test@f1dashboard.com", 
            "full_name": "Test User",
            "role": "viewer"
        }
    }
    return FALLBACK_USERS.get(username)

# FIXED: Add the missing verify_token function
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security), db: DB = Depends(get_db)) -> dict:
    """Enhanced token verification with database lookup"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        
        if username is None:
            logger.warning("Token missing username claim")
            raise HTTPException(status_code=401, detail="Invalid token format")
            
        user = get_user_by_username(username, db)
        if not user:
            logger.warning(f"Token for non-existent user: {username}")
            raise HTTPException(status_code=401, detail="User no longer exists")
            
        return {"username": username, "user": user}
        
    except jwt.ExpiredSignatureError:
        logger.warning("Expired token used")
        raise HTTPException(status_code=401, detail="Token has expired - please log in again")
    except jwt.InvalidTokenError:
        logger.warning("Invalid token format")
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    except Exception as e:
        logger.error(f"Unexpected error during token verification: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication verification failed")

@auth_router.post("/login")
def login(credentials: LoginRequest, db: DB = Depends(get_db)):
    """Enhanced login with database integration and fallback"""
    try:
        logger.info(f"Login attempt for username: {credentials.username}")
        
        # Input validation
        if not credentials.username or not credentials.password:
            logger.warning("Login attempt with missing credentials")
            raise HTTPException(
                status_code=400,
                detail="Username and password are required"
            )
        
        username = credentials.username.lower().strip()
        logger.info(f"Looking for user: {username}")
        
        # First, try database authentication
        user = get_user_from_db(username, db)
        logger.info(f"Database lookup result: {'Found' if user else 'Not found'}")
        
        # If not found in database, try fallback static users
        if not user:
            FALLBACK_USERS = {
                "admin": {
                    "id": 999,
                    "username": "admin", 
                    "password": "admin",
                    "email": "admin@f1dashboard.com",
                    "full_name": "F1 Administrator",
                    "role": "admin"
                },
                "user": {
                    "id": 998,
                    "username": "user",
                    "password": "user123", 
                    "email": "user@f1dashboard.com", 
                    "full_name": "F1 User",
                    "role": "user"
                },
                "test": {
                    "id": 997,
                    "username": "test",
                    "password": "test", 
                    "email": "test@f1dashboard.com", 
                    "full_name": "Test User",
                    "role": "viewer"
                }
            }
            user = FALLBACK_USERS.get(username)
            if user:
                logger.info(f"Found user in fallback: {username}")
        
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
        token_data = {
            "sub": user["username"], 
            "user_id": user["id"],
            "role": user.get("role", "user")
        }
        access_token = create_access_token(token_data)
        
        # Prepare response
        user_info = {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user.get("role", "user")
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