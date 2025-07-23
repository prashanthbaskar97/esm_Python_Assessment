import sqlite3
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from esm_fullstack_challenge.models import AutoGenModels
from esm_fullstack_challenge.routers.utils import get_route_list_function, get_route_id_function
from esm_fullstack_challenge.dependencies import get_db
from esm_fullstack_challenge.db import DB

races_router = APIRouter()
table_model = AutoGenModels['races']

# --------------------- GET: Single & List ---------------------

get_race = get_route_id_function('races', table_model)
races_router.add_api_route(
    '/{id}', get_race,
    methods=["GET"], response_model=table_model,
)

get_races = get_route_list_function('races', table_model)
races_router.add_api_route(
    '', get_races,
    methods=["GET"], response_model=List[table_model],
)

# --------------------- Custom GET: Circuit Info ---------------------

@races_router.get("/{id}/circuit")
def get_race_circuit(id: int, db: DB = Depends(get_db)):
    """
    Returns circuit info for a given race ID by joining races and circuits tables.
    """
    with db.get_connection() as conn:
        conn.row_factory = sqlite3.Row  # Enable dictionary-like access
        cursor = conn.cursor()
        result = cursor.execute(
            """
            SELECT circuits.*
            FROM races
            JOIN circuits ON races.circuit_id = circuits.id
            WHERE races.id = ?
            """, (id,)
        ).fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="Circuit not found")

        return dict(result)

# --------------------- Custom GET: Drivers Info ---------------------

@races_router.get("/{id}/drivers")
def get_race_drivers(id: int, db: DB = Depends(get_db)):
    """
    Returns a list of drivers who participated in the given race ID.
    """
    with db.get_connection() as conn:
        conn.row_factory = sqlite3.Row  # Enable dictionary-like access
        cursor = conn.cursor()
        result = cursor.execute(
            """
            SELECT DISTINCT drivers.*
            FROM results
            JOIN drivers ON results.driver_id = drivers.id
            WHERE results.race_id = ?
            """, (id,)
        ).fetchall()

        return [dict(row) for row in result]

# --------------------- Custom GET: Constructors Info ---------------------

@races_router.get("/{id}/constructors")
def get_race_constructors(id: int, db: DB = Depends(get_db)):
    """
    Returns a list of constructors who participated in the given race ID.
    """
    with db.get_connection() as conn:
        conn.row_factory = sqlite3.Row  # Enable dictionary-like access
        cursor = conn.cursor()
        result = cursor.execute(
            """
            SELECT DISTINCT constructors.*
            FROM results
            JOIN constructors ON results.constructor_id = constructors.id
            WHERE results.race_id = ?
            """, (id,)
        ).fetchall()

        return [dict(row) for row in result]

# --------------------- Custom GET: Full Race Details ---------------------

@races_router.get("/{id}/details")
def get_race_with_all_details(id: int, db: DB = Depends(get_db)):
    """
    Returns full race info including circuit, drivers, and constructors.
    """
    with db.get_connection() as conn:
        conn.row_factory = sqlite3.Row  # Enable dictionary-like access
        cursor = conn.cursor()

        # Race base info
        race = cursor.execute("SELECT * FROM races WHERE id = ?", (id,)).fetchone()
        if not race:
            raise HTTPException(status_code=404, detail="Race not found")

        # Circuit
        circuit = cursor.execute(
            """
            SELECT circuits.*
            FROM races
            JOIN circuits ON races.circuit_id = circuits.id
            WHERE races.id = ?
            """, (id,)
        ).fetchone()

        # Drivers
        drivers = cursor.execute(
            """
            SELECT DISTINCT drivers.*
            FROM results
            JOIN drivers ON results.driver_id = drivers.id
            WHERE results.race_id = ?
            """, (id,)
        ).fetchall()

        # Constructors
        constructors = cursor.execute(
            """
            SELECT DISTINCT constructors.*
            FROM results
            JOIN constructors ON results.constructor_id = constructors.id
            WHERE results.race_id = ?
            """, (id,)
        ).fetchall()

        return {
            "id": race["id"],
            "year": race["year"],
            "round": race["round"],
            "name": race["name"],
            "date": race["date"],
            "time": race["time"],
            "url": race["url"],
            "circuit": dict(circuit) if circuit else None,
            "drivers": [dict(row) for row in drivers],
            "constructors": [dict(row) for row in constructors],
        }