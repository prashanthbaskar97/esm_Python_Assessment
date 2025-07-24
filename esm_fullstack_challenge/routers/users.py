import sqlite3
import logging
from typing import List
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, field_validator, EmailStr
from typing import Optional

from esm_fullstack_challenge.dependencies import get_db
from esm_fullstack_challenge.db import DB
from esm_fullstack_challenge.routers.auth import verify_token

users_router = APIRouter()
logger = logging.getLogger(__name__)
security = HTTPBearer()

# Pydantic models for user management
class UserCreate(BaseModel):
    username: str
    email: str
    full_name: str
    role: str
    password: str

    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Username cannot be empty')
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters long')
        if len(v) > 50:
            raise ValueError('Username too long (max 50 characters)')
        return v.strip()

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Email cannot be empty')
        # Basic email validation
        if '@' not in v or '.' not in v:
            raise ValueError('Please enter a valid email address')
        return v.strip().lower()

    @field_validator('full_name')
    @classmethod
    def validate_full_name(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Full name cannot be empty')
        return v.strip()

    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        valid_roles = ['admin', 'user', 'viewer']
        if v not in valid_roles:
            raise ValueError(f'Role must be one of: {", ".join(valid_roles)}')
        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if not v or len(v) < 4:
            raise ValueError('Password must be at least 4 characters long')
        return v

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

class User(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    created_at: str

    class Config:
        from_attributes = True

# Role-based access control functions
def get_current_user_info(token_data: dict, db: DB) -> dict:
    """Get current user information from token"""
    username = token_data.get('username')
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Get user from token data or database
    if 'user' in token_data:
        return token_data['user']
    
    # Fallback: get from database
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, username, email, full_name, role
                FROM users WHERE username = ?
            """, (username,))
            row = cursor.fetchone()
            
            if row:
                return {
                    "id": row[0],
                    "username": row[1],
                    "email": row[2],
                    "full_name": row[3],
                    "role": row[4]
                }
    except Exception as e:
        logger.error(f"Error getting user info: {e}")
    
    # Static fallback users
    static_users = {
        "admin": {"id": 999, "username": "admin", "role": "admin", "full_name": "Administrator"},
        "user": {"id": 998, "username": "user", "role": "user", "full_name": "Standard User"},
        "test": {"id": 997, "username": "test", "role": "viewer", "full_name": "Test User"}
    }
    
    return static_users.get(username, {"role": "viewer"})

def require_admin_access(credentials: HTTPAuthorizationCredentials = Depends(security), db: DB = Depends(get_db)):
    """Dependency that requires admin access"""
    try:
        token_data = verify_token(credentials, db)
        current_user = get_current_user_info(token_data, db)
        
        if current_user.get('role') != 'admin':
            raise HTTPException(
                status_code=403,
                detail="Admin access required. Only administrators can manage users."
            )
        
        return current_user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Access control error: {e}")
        raise HTTPException(status_code=401, detail="Authentication required")

def require_authenticated_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: DB = Depends(get_db)):
    """Dependency that requires any authenticated user"""
    try:
        token_data = verify_token(credentials, db)
        return get_current_user_info(token_data, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(status_code=401, detail="Authentication required")

# Initialize users table if it doesn't exist
def init_users_table(db: DB):
    """Create users table if it doesn't exist"""
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    full_name TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'user',
                    password TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Insert default users if table is empty
            cursor.execute("SELECT COUNT(*) FROM users")
            if cursor.fetchone()[0] == 0:
                default_users = [
                    ('admin', 'admin@f1dashboard.com', 'F1 Administrator', 'admin', 'admin'),
                    ('user', 'user@f1dashboard.com', 'F1 User', 'user', 'user123'),
                    ('test', 'test@f1dashboard.com', 'Test User', 'viewer', 'test'),
                ]
                
                cursor.executemany("""
                    INSERT INTO users (username, email, full_name, role, password)
                    VALUES (?, ?, ?, ?, ?)
                """, default_users)
                
            conn.commit()
            logger.info("Users table initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize users table: {str(e)}")

def row_to_user(row) -> dict:
    """Convert SQLite row to user dictionary"""
    return {
        "id": row[0],
        "username": row[1],
        "email": row[2],
        "full_name": row[3],
        "role": row[4],
        "created_at": row[6]  # Skip password field
    }

# PROTECTED: Only authenticated users can view users list
@users_router.get("/users", response_model=List[User])
async def get_users(
    response: Response,
    _start: int = 0,
    _end: int = 25,
    _sort: str = "id",
    _order: str = "ASC",
    current_user: dict = Depends(require_authenticated_user),
    db: DB = Depends(get_db)
):
    """Get list of users with pagination and sorting - requires authentication"""
    try:
        logger.info(f"User {current_user.get('username')} accessing users list")
        
        # Initialize table if needed
        init_users_table(db)
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            
            # Validate sort field
            valid_sort_fields = ["id", "username", "email", "full_name", "role", "created_at"]
            if _sort not in valid_sort_fields:
                _sort = "id"
            
            if _order.upper() not in ["ASC", "DESC"]:
                _order = "ASC"
            
            # Get total count first
            cursor.execute("SELECT COUNT(*) FROM users")
            total_count = cursor.fetchone()[0]
            
            # Get users with pagination (exclude password)
            query = f"""
            SELECT id, username, email, full_name, role, password, created_at
            FROM users
            ORDER BY {_sort} {_order}
            LIMIT ? OFFSET ?
            """
            
            cursor.execute(query, (_end - _start, _start))
            rows = cursor.fetchall()
            
            users = [row_to_user(row) for row in rows]
            
            # Add Content-Range header for React Admin
            response.headers["Content-Range"] = f"users {_start}-{_start + len(users) - 1}/{total_count}"
            response.headers["Access-Control-Expose-Headers"] = "Content-Range"
            
            logger.info(f"Retrieved {len(users)} users (total: {total_count})")
            return users
            
    except Exception as e:
        logger.error(f"Error retrieving users: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )

# PROTECTED: Only authenticated users can view user details
@users_router.get("/users/{user_id}", response_model=User)
async def get_user(
    user_id: int, 
    current_user: dict = Depends(require_authenticated_user),
    db: DB = Depends(get_db)
):
    """Get a specific user by ID - requires authentication"""
    try:
        logger.info(f"User {current_user.get('username')} accessing user {user_id}")
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            
            query = """
            SELECT id, username, email, full_name, role, password, created_at
            FROM users WHERE id = ?
            """
            
            cursor.execute(query, (user_id,))
            row = cursor.fetchone()
            
            if not row:
                raise HTTPException(
                    status_code=404,
                    detail=f"User with id {user_id} not found"
                )
            
            return row_to_user(row)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )

# ADMIN ONLY: Only admins can create users
@users_router.post("/users", response_model=User, status_code=201)
async def create_user(
    user: UserCreate, 
    current_user: dict = Depends(require_admin_access),
    db: DB = Depends(get_db)
):
    """Create a new user - ADMIN ONLY"""
    try:
        logger.info(f"Admin {current_user.get('username')} creating user: {user.username}")
        
        # Initialize table if needed
        init_users_table(db)
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            
            # Check if username already exists
            cursor.execute("SELECT id FROM users WHERE username = ?", (user.username,))
            if cursor.fetchone():
                raise HTTPException(
                    status_code=409,
                    detail=f"Username '{user.username}' already exists"
                )
            
            # Check if email already exists
            cursor.execute("SELECT id FROM users WHERE email = ?", (user.email,))
            if cursor.fetchone():
                raise HTTPException(
                    status_code=409,
                    detail=f"Email '{user.email}' already exists"
                )
            
            # Insert new user
            insert_query = """
            INSERT INTO users (username, email, full_name, role, password)
            VALUES (?, ?, ?, ?, ?)
            """
            
            cursor.execute(insert_query, (
                user.username,
                user.email,
                user.full_name,
                user.role,
                user.password  # In production, this should be hashed
            ))
            
            user_id = cursor.lastrowid
            conn.commit()
            
            logger.info(f"Successfully created user: {user.username}")
            return await get_user(user_id, current_user, db)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create user: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create user: {str(e)}"
        )

# ADMIN ONLY: Only admins can update users
@users_router.put("/users/{user_id}", response_model=User)
async def update_user(
    user_id: int, 
    user: UserUpdate, 
    current_user: dict = Depends(require_admin_access),
    db: DB = Depends(get_db)
):
    """Update an existing user - ADMIN ONLY"""
    try:
        logger.info(f"Admin {current_user.get('username')} updating user: {user_id}")
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            
            # Check if user exists
            cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=404,
                    detail=f"User with id {user_id} not found"
                )
            
            # Build update query dynamically
            update_fields = []
            update_values = []
            
            if user.username is not None:
                # Check if new username already exists (excluding current user)
                cursor.execute("SELECT id FROM users WHERE username = ? AND id != ?", 
                             (user.username, user_id))
                if cursor.fetchone():
                    raise HTTPException(
                        status_code=409,
                        detail=f"Username '{user.username}' already exists"
                    )
                update_fields.append("username = ?")
                update_values.append(user.username)
            
            if user.email is not None:
                # Check if new email already exists (excluding current user)
                cursor.execute("SELECT id FROM users WHERE email = ? AND id != ?", 
                             (user.email, user_id))
                if cursor.fetchone():
                    raise HTTPException(
                        status_code=409,
                        detail=f"Email '{user.email}' already exists"
                    )
                update_fields.append("email = ?")
                update_values.append(user.email)
            
            if user.full_name is not None:
                update_fields.append("full_name = ?")
                update_values.append(user.full_name)
            
            if user.role is not None:
                valid_roles = ['admin', 'user', 'viewer']
                if user.role not in valid_roles:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Role must be one of: {', '.join(valid_roles)}"
                    )
                update_fields.append("role = ?")
                update_values.append(user.role)
            
            if user.password is not None and user.password.strip():
                update_fields.append("password = ?")
                update_values.append(user.password)
            
            if not update_fields:
                raise HTTPException(
                    status_code=400,
                    detail="No fields provided for update"
                )
            
            # Execute update
            update_query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"
            update_values.append(user_id)
            
            cursor.execute(update_query, update_values)
            conn.commit()
            
            logger.info(f"Successfully updated user: {user_id}")
            return await get_user(user_id, current_user, db)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update user: {str(e)}"
        )

# ADMIN ONLY: Only admins can delete users
@users_router.delete("/users/{user_id}")
async def delete_user(
    user_id: int, 
    current_user: dict = Depends(require_admin_access),
    db: DB = Depends(get_db)
):
    """Delete a user - ADMIN ONLY"""
    try:
        logger.info(f"Admin {current_user.get('username')} deleting user: {user_id}")
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            
            # Check if user exists
            cursor.execute("SELECT username FROM users WHERE id = ?", (user_id,))
            user_row = cursor.fetchone()
            
            if not user_row:
                raise HTTPException(
                    status_code=404,
                    detail=f"User with id {user_id} not found"
                )
            
            username = user_row[0]
            
            # Prevent deletion of admin user
            if username == 'admin':
                raise HTTPException(
                    status_code=400,
                    detail="Cannot delete the main admin user"
                )
            
            # Prevent admins from deleting themselves
            if username == current_user.get('username'):
                raise HTTPException(
                    status_code=400,
                    detail="Cannot delete your own account"
                )
            
            # Delete the user
            cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()
            
            logger.info(f"Successfully deleted user: {username}")
            return {"message": f"User {username} deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete user: {str(e)}"
        )