import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_admin_user, get_current_user
from schemas.auth import UserResponse
from services.registered_kits import Registered_kitsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/registered_kits", tags=["registered_kits"])


# ---------- Pydantic Schemas ----------
class Registered_kitsData(BaseModel):
    """Entity data schema (for create/update)"""
    kit_type: str
    label: str
    location_note: str = None
    contents: str = None
    missing_items: str = None
    last_checked: str = None


class Registered_kitsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    kit_type: Optional[str] = None
    label: Optional[str] = None
    location_note: Optional[str] = None
    contents: Optional[str] = None
    missing_items: Optional[str] = None
    last_checked: Optional[str] = None


class Registered_kitsResponse(BaseModel):
    """Entity response schema"""
    id: int
    kit_type: str
    label: str
    location_note: Optional[str] = None
    contents: Optional[str] = None
    missing_items: Optional[str] = None
    last_checked: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Registered_kitsListResponse(BaseModel):
    """List response schema"""
    items: List[Registered_kitsResponse]
    total: int
    skip: int
    limit: int


class Registered_kitsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Registered_kitsData]


class Registered_kitsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Registered_kitsUpdateData


class Registered_kitsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Registered_kitsBatchUpdateItem]


class Registered_kitsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Registered_kitsListResponse)
async def query_registered_kitss(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
    _current_user: UserResponse = Depends(get_current_user),
):
    """Query registered_kitss with filtering, sorting, and pagination"""
    logger.debug(f"Querying registered_kitss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Registered_kitsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} registered_kitss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid registered_kits query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying registered_kitss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Registered_kitsListResponse)
async def query_registered_kitss_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
    _current_user: UserResponse = Depends(get_admin_user),
):
    # Query registered_kitss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying registered_kitss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Registered_kitsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} registered_kitss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid registered_kits query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying registered_kitss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Registered_kitsResponse)
async def get_registered_kits(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
    _current_user: UserResponse = Depends(get_current_user),
):
    """Get a single registered_kits by ID"""
    logger.debug(f"Fetching registered_kits with id: {id}, fields={fields}")
    
    service = Registered_kitsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Registered_kits with id {id} not found")
            raise HTTPException(status_code=404, detail="Registered_kits not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching registered_kits {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Registered_kitsResponse, status_code=201)
async def create_registered_kits(
    data: Registered_kitsData,
    db: AsyncSession = Depends(get_db),
    _current_user: UserResponse = Depends(get_current_user),
):
    """Create a new registered_kits"""
    logger.debug(f"Creating new registered_kits with data: {data}")
    
    service = Registered_kitsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create registered_kits")
        
        logger.info(f"Registered_kits created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating registered_kits: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating registered_kits: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Registered_kitsResponse], status_code=201)
async def create_registered_kitss_batch(
    request: Registered_kitsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: UserResponse = Depends(get_current_user),
):
    """Create multiple registered_kitss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} registered_kitss")
    
    service = Registered_kitsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} registered_kitss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Registered_kitsResponse])
async def update_registered_kitss_batch(
    request: Registered_kitsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: UserResponse = Depends(get_current_user),
):
    """Update multiple registered_kitss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} registered_kitss")
    
    service = Registered_kitsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} registered_kitss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Registered_kitsResponse)
async def update_registered_kits(
    id: int,
    data: Registered_kitsUpdateData,
    db: AsyncSession = Depends(get_db),
    _current_user: UserResponse = Depends(get_current_user),
):
    """Update an existing registered_kits"""
    logger.debug(f"Updating registered_kits {id} with data: {data}")

    service = Registered_kitsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Registered_kits with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Registered_kits not found")
        
        logger.info(f"Registered_kits {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating registered_kits {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating registered_kits {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_registered_kitss_batch(
    request: Registered_kitsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: UserResponse = Depends(get_current_user),
):
    """Delete multiple registered_kitss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} registered_kitss")
    
    service = Registered_kitsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} registered_kitss successfully")
        return {"message": f"Successfully deleted {deleted_count} registered_kitss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_registered_kits(
    id: int,
    db: AsyncSession = Depends(get_db),
    _current_user: UserResponse = Depends(get_current_user),
):
    """Delete a single registered_kits by ID"""
    logger.debug(f"Deleting registered_kits with id: {id}")
    
    service = Registered_kitsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Registered_kits with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Registered_kits not found")
        
        logger.info(f"Registered_kits {id} deleted successfully")
        return {"message": "Registered_kits deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting registered_kits {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")