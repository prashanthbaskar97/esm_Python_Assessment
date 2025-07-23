import pandas as pd
import sqlite3
import logging
from fastapi import APIRouter, Depends, HTTPException

from esm_fullstack_challenge.db import DB, query_builder
from esm_fullstack_challenge.dependencies import get_db, CommonQueryParams

dashboard_router = APIRouter()

# Set up logging for better error tracking
logger = logging.getLogger(__name__)

@dashboard_router.get("/top_drivers_by_wins")
def get_top_drivers_by_wins(
    cqp: CommonQueryParams = Depends(CommonQueryParams),
    db: DB = Depends(get_db)
) -> list:
    """Gets top drivers by wins with enhanced error handling."""
    try:
        # Build CTE to get driver wins - only count finished races where they came 1st
        base_query_str = (
            "with driver_wins as (\n"
            "    select d.id,\n"
            "        d.forename || ' ' || d.surname as full_name,\n"
            "        d.nationality,\n"
            "        d.dob,\n"
            "        date() - date(dob) as age,\n"
            "        d.url\n"
            "    from drivers d\n"
            "          join results r on d.id = r.driver_id\n"
            "          join status s on r.status_id = s.id\n"
            "    where s.status = 'Finished'\n"
            "    and r.position_order = 1\n"
            ")\n"
            "select\n"
            "    *,\n"
            "    count(*) as number_of_wins\n"
            "from driver_wins"
        )
        
        query_str = query_builder(
            custom_select=base_query_str,
            order_by=cqp.order_by or [('number_of_wins', 'desc')],
            limit=cqp.limit,
            offset=cqp.offset,
            filter_by=cqp.filter_by,
            group_by=['id', 'full_name', 'nationality', 'dob', 'age', 'url']
        )
        
        with db.get_connection() as conn:
            df = pd.read_sql_query(query_str, conn)
            drivers = list(df.to_dict(orient='records'))
            
        logger.info(f"Successfully retrieved {len(drivers)} top drivers")
        return drivers
        
    except Exception as e:
        logger.error(f"Error retrieving top drivers: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to retrieve top drivers data: {str(e)}"
        )

@dashboard_router.get("/constructor_championships")
def get_constructor_championships(db: DB = Depends(get_db)) -> list:
    """Get constructor points by year with error handling"""
    try:
        sql = """
        SELECT 
            r.year,
            c.name as constructor,
            SUM(res.points) as total_points
        FROM results res
        JOIN races r ON res.race_id = r.id
        JOIN constructors c ON res.constructor_id = c.id
        WHERE r.year >= 2005
        GROUP BY r.year, c.id, c.name
        HAVING total_points > 50
        ORDER BY r.year, total_points DESC
        """
        
        with db.get_connection() as conn:
            conn.row_factory = sqlite3.Row
            results = pd.read_sql_query(sql, conn)
            data = results.to_dict('records')
            
        logger.info(f"Retrieved constructor data for {len(data)} records")
        return data
        
    except Exception as e:
        logger.error(f"Error retrieving constructor championships: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve constructor championship data: {str(e)}"
        )

@dashboard_router.get("/circuits_race_count")  
def get_circuits_race_count(db: DB = Depends(get_db)) -> list:
    """Return most frequently used circuits with error handling"""
    try:
        with db.get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            circuit_data = cursor.execute("""
                SELECT 
                    c.name as circuit_name,
                    c.location,
                    c.country,
                    COUNT(r.id) as race_count
                FROM circuits c
                JOIN races r ON c.id = r.circuit_id
                GROUP BY c.id, c.name, c.location, c.country
                ORDER BY race_count DESC
                LIMIT 15
            """).fetchall()
            
            result = [dict(row) for row in circuit_data]
            logger.info(f"Retrieved {len(result)} circuit records")
            return result
            
    except Exception as e:
        logger.error(f"Error retrieving circuit data: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve circuit usage data: {str(e)}"
        )

@dashboard_router.get("/driver_nationality_stats")
def get_driver_nationality_stats(db: DB = Depends(get_db)) -> list:
    """Driver breakdown by nationality with error handling"""
    try:
        nationality_query = """
        SELECT 
            nationality,
            COUNT(*) as driver_count,
            COUNT(CASE WHEN wins.wins > 0 THEN 1 END) as winners_count
        FROM drivers d
        LEFT JOIN (
            SELECT 
                driver_id,
                COUNT(*) as wins
            FROM results 
            WHERE position_order = 1
            GROUP BY driver_id
        ) wins ON d.id = wins.driver_id
        GROUP BY nationality
        HAVING driver_count >= 3
        ORDER BY driver_count DESC
        """
        
        with db.get_connection() as conn:
            conn.row_factory = sqlite3.Row
            df = pd.read_sql_query(nationality_query, conn)
            data = df.to_dict('records')
            
        logger.info(f"Retrieved nationality data for {len(data)} countries")
        return data
        
    except Exception as e:
        logger.error(f"Error retrieving nationality stats: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve driver nationality data: {str(e)}"
        )

@dashboard_router.get("/season_results_overview")
def get_season_results_overview(db: DB = Depends(get_db)) -> list:
    """Gets season overview with enhanced error handling"""
    try:
        query_str = """
        SELECT 
            r.year,
            COUNT(DISTINCT r.id) as total_races,
            COUNT(DISTINCT res.driver_id) as unique_drivers,
            COUNT(DISTINCT res.constructor_id) as unique_constructors,
            ROUND(AVG(res.points), 2) as avg_points_per_result,
            COUNT(CASE WHEN res.position_order = 1 THEN 1 END) as total_wins
        FROM races r
        JOIN results res ON r.id = res.race_id  
        WHERE r.year >= 2000
        GROUP BY r.year
        ORDER BY r.year
        """
        
        with db.get_connection() as conn:
            conn.row_factory = sqlite3.Row
            df = pd.read_sql_query(query_str, conn)
            data = df.to_dict(orient='records')
            
        logger.info(f"Retrieved season overview for {len(data)} years")
        return data
        
    except Exception as e:
        logger.error(f"Error retrieving season overview: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve season overview data: {str(e)}"
        )