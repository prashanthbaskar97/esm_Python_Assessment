import sqlite3
import logging
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator
from fastapi import Request
from typing import Union

from esm_fullstack_challenge.models import AutoGenModels
from esm_fullstack_challenge.routers.utils import get_route_list_function, get_route_id_function
from esm_fullstack_challenge.dependencies import get_db
from esm_fullstack_challenge.db import DB

drivers_router = APIRouter()
table_model = AutoGenModels['drivers']

# Set up logging for better error tracking
logger = logging.getLogger(__name__)

# --------------------- GET: Single & List ---------------------

get_driver = get_route_id_function('drivers', table_model)
drivers_router.add_api_route(
    '/{id}', get_driver, methods=["GET"], response_model=table_model
)

get_drivers = get_route_list_function('drivers', table_model)
drivers_router.add_api_route(
    '', get_drivers, methods=["GET"], response_model=List[table_model]
)

# --------------------- Enhanced Schema with Validation ---------------------

class DriverCreate(BaseModel):
    driver_ref: str
    number: str
    code: str
    forename: str
    surname: str
    dob: str  # YYYY-MM-DD format expected
    nationality: str
    url: str

    @field_validator('driver_ref')
    @classmethod
    def validate_driver_ref(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Driver reference cannot be empty')
        if len(v) > 50:
            raise ValueError('Driver reference too long (max 50 characters)')
        return v.strip()

    @field_validator('forename', 'surname')
    @classmethod
    def validate_names(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Name fields cannot be empty')
        if len(v) > 50:
            raise ValueError('Name too long (max 50 characters)')
        return v.strip()

    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        if v and len(v) > 3:
            raise ValueError('Driver code must be 3 characters or less')
        return v.strip() if v else None

    @field_validator('nationality')
    @classmethod
    def validate_nationality(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Nationality cannot be empty')
        return v.strip()

    @field_validator('dob')
    @classmethod
    def validate_dob(cls, v):
        if not v:
            raise ValueError('Date of birth is required')
        # Basic date format validation (YYYY-MM-DD)
        parts = v.split('-')
        if len(parts) != 3:
            raise ValueError('Date must be in YYYY-MM-DD format')
        try:
            year, month, day = map(int, parts)
            if year < 1900 or year > 2010:
                raise ValueError('Invalid birth year (must be between 1900-2010)')
            if month < 1 or month > 12:
                raise ValueError('Invalid month (must be 1-12)')
            if day < 1 or day > 31:
                raise ValueError('Invalid day (must be 1-31)')
        except ValueError as e:
            if "invalid literal" in str(e):
                raise ValueError('Date must contain only numbers in YYYY-MM-DD format')
            raise
        return v

# --------------------- POST: Create Driver ---------------------

@drivers_router.post('', response_model=table_model)
def create_driver(driver: DriverCreate, request: Request, db: DB = Depends(get_db)):
    """Create a new driver with enhanced validation and error handling"""
    try:
        logger.info(f"Creating new driver: {driver.forename} {driver.surname}")
        
        with db.get_connection() as conn:
            conn.row_factory = sqlite3.Row  # Enable dictionary access
            cursor = conn.cursor()
            
            # Check for duplicate driver_ref
            existing = cursor.execute(
                "SELECT id FROM drivers WHERE driver_ref = ?",
                (driver.driver_ref,)
            ).fetchone()
            
            if existing:
                raise HTTPException(
                    status_code=409,
                    detail=f"Driver with reference '{driver.driver_ref}' already exists"
                )
            
            # Check for duplicate driver code if provided
            if driver.code:
                existing_code = cursor.execute(
                    "SELECT id FROM drivers WHERE code = ? AND code != ''",
                    (driver.code,)
                ).fetchone()
                
                if existing_code:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Driver code '{driver.code}' is already in use"
                    )
            
            # Insert new driver
            cursor.execute(
                """
                INSERT INTO drivers (driver_ref, number, code, forename, surname, dob, nationality, url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    driver.driver_ref,
                    driver.number,
                    driver.code,
                    driver.forename,
                    driver.surname,
                    driver.dob,
                    driver.nationality,
                    driver.url,
                )
            )
            conn.commit()
            new_id = cursor.lastrowid
            
            logger.info(f"Successfully created driver with ID: {new_id}")
            return table_model(id=new_id, **driver.dict())
            
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except ValueError as e:
        logger.warning(f"Validation error creating driver: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except sqlite3.IntegrityError as e:
        logger.error(f"Database integrity error: {str(e)}")
        raise HTTPException(
            status_code=409,
            detail="Driver creation failed due to data conflict"
        )
    except Exception as e:
        logger.error(f"Unexpected error creating driver: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error occurred while creating driver"
        )

# --------------------- PUT: Update Driver ---------------------

@drivers_router.put('/{id}', response_model=table_model)
def update_driver(id: int, driver: DriverCreate, db: DB = Depends(get_db)):
    """Update an existing driver with enhanced validation and error handling"""
    try:
        logger.info(f"Updating driver ID: {id}")
        
        with db.get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Check if driver exists
            existing = cursor.execute(
                "SELECT * FROM drivers WHERE id = ?",
                (id,)
            ).fetchone()
            
            if not existing:
                raise HTTPException(
                    status_code=404,
                    detail=f"Driver with ID {id} not found"
                )
            
            # Check for duplicate driver_ref (excluding current driver)
            duplicate_ref = cursor.execute(
                "SELECT id FROM drivers WHERE driver_ref = ? AND id != ?",
                (driver.driver_ref, id)
            ).fetchone()
            
            if duplicate_ref:
                raise HTTPException(
                    status_code=409,
                    detail=f"Driver reference '{driver.driver_ref}' is already in use by another driver"
                )
            
            # Check for duplicate code (excluding current driver)
            if driver.code:
                duplicate_code = cursor.execute(
                    "SELECT id FROM drivers WHERE code = ? AND id != ? AND code != ''",
                    (driver.code, id)
                ).fetchone()
                
                if duplicate_code:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Driver code '{driver.code}' is already in use by another driver"
                    )
            
            # Update driver
            cursor.execute(
                """
                UPDATE drivers
                SET driver_ref = ?, number = ?, code = ?, forename = ?, surname = ?, 
                    dob = ?, nationality = ?, url = ?
                WHERE id = ?
                """,
                (
                    driver.driver_ref,
                    driver.number,
                    driver.code,
                    driver.forename,
                    driver.surname,
                    driver.dob,
                    driver.nationality,
                    driver.url,
                    id,
                )
            )

            if cursor.rowcount == 0:
                raise HTTPException(
                    status_code=404,
                    detail=f"Driver with ID {id} could not be updated"
                )

            conn.commit()
            logger.info(f"Successfully updated driver ID: {id}")
            return table_model(id=id, **driver.dict())
            
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except ValueError as e:
        logger.warning(f"Validation error updating driver {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except sqlite3.IntegrityError as e:
        logger.error(f"Database integrity error updating driver {id}: {str(e)}")
        raise HTTPException(
            status_code=409,
            detail="Driver update failed due to data conflict"
        )
    except Exception as e:
        logger.error(f"Unexpected error updating driver {id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error occurred while updating driver"
        )

# --------------------- DELETE: Delete Driver ---------------------

@drivers_router.delete('/{id}', response_model=table_model)
def delete_driver(id: int, db: DB = Depends(get_db)):
    """Delete a driver - Admin can delete any driver"""
    try:
        logger.info(f"Attempting to delete driver ID: {id}")
        
        with db.get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Check if driver exists and get their data
            existing = cursor.execute(
                "SELECT * FROM drivers WHERE id = ?",
                (id,)
            ).fetchone()

            if not existing:
                raise HTTPException(
                    status_code=404,
                    detail=f"Driver with ID {id} not found"
                )
            
            # REMOVED: Safety check for race results - Admin can delete any driver
            # Admin has full control to delete drivers even with race results
            
            # Perform deletion
            cursor.execute("DELETE FROM drivers WHERE id = ?", (id,))
            
            if cursor.rowcount == 0:
                raise HTTPException(
                    status_code=404,
                    detail=f"Driver with ID {id} could not be deleted"
                )
            
            conn.commit()
            logger.info(f"Successfully deleted driver ID: {id}")
            
            # Return the deleted driver data
            return table_model(**dict(existing))
            
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except sqlite3.IntegrityError as e:
        logger.error(f"Database integrity error deleting driver {id}: {str(e)}")
        # Even if there are foreign key constraints, let admin know what happened
        raise HTTPException(
            status_code=409,
            detail=f"Database constraint error: {str(e)}. You may need to delete related records first."
        )
    except Exception as e:
        logger.error(f"Unexpected error deleting driver {id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error occurred while deleting driver"
        )