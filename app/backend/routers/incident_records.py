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
from services.incident_records import Incident_recordsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/incident_records", tags=["incident_records"])


# ---------- Pydantic Schemas ----------
class Incident_recordsData(BaseModel):
    """Entity data schema (for create/update)"""
    context_type: str
    occurred_at: str
    location_summary: str = None
    latitude: float = None
    longitude: float = None
    location_accuracy: float = None
    victim_count: int
    triage_summary: str = None
    hazards: str = None
    kit_items: str = None
    procedure_id: str = None
    interventions: str = None
    includes_health_data: bool = None
    called_112: str
    brief_text: str = None
    content_pack_version: str = None
    retention_choice: str = None


class Incident_recordsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    context_type: Optional[str] = None
    occurred_at: Optional[str] = None
    location_summary: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy: Optional[float] = None
    victim_count: Optional[int] = None
    triage_summary: Optional[str] = None
    hazards: Optional[str] = None
    kit_items: Optional[str] = None
    procedure_id: Optional[str] = None
    interventions: Optional[str] = None
    includes_health_data: Optional[bool] = None
    called_112: Optional[str] = None
    brief_text: Optional[str] = None
    content_pack_version: Optional[str] = None
    retention_choice: Optional[str] = None


class Incident_recordsResponse(BaseModel):
    """Entity response schema"""
    id: int
    context_type: str
    occurred_at: str
    location_summary: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy: Optional[float] = None
    victim_count: int
    triage_summary: Optional[str] = None
    hazards: Optional[str] = None
    kit_items: Optional[str] = None
    procedure_id: Optional[str] = None
    interventions: Optional[str] = None
    includes_health_data: Optional[bool] = None
    called_112: str
    brief_text: Optional[str] = None
    content_pack_version: Optional[str] = None
    retention_choice: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Incident_recordsListResponse(BaseModel):
    """List response schema"""
    items: List[Incident_recordsResponse]
    total: int
    skip: int
    limit: int


class Incident_recordsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Incident_recordsData]


class Incident_recordsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Incident_recordsUpdateData


class Incident_recordsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Incident_recordsBatchUpdateItem]


class Incident_recordsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Incident_recordsListResponse)
async def query_incident_recordss(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Query incident_recordss with filtering, sorting, and pagination — always
    scoped to the current user. Use GET /all (admin-only) for an unscoped view."""
    logger.debug(f"Querying incident_recordss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Incident_recordsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        # Force-scope to the caller regardless of what the client asked for —
        # never trust a client-supplied user_id filter.
        query_dict = {**(query_dict or {}), "user_id": current_user.id}

        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} incident_recordss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid incident_records query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying incident_recordss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Incident_recordsListResponse)
async def query_incident_recordss_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
    _current_user: UserResponse = Depends(get_admin_user),
):
    # Query incident_recordss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying incident_recordss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Incident_recordsService(db)
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
        logger.debug(f"Found {result['total']} incident_recordss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid incident_records query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying incident_recordss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Incident_recordsResponse)
async def get_incident_records(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Get a single incident_records by ID, owned by the caller."""
    logger.debug(f"Fetching incident_records with id: {id}, fields={fields}")

    service = Incident_recordsService(db)
    try:
        result = await service.get_by_id(id)
        # 404 (not 403) on a non-owned record too — don't confirm it exists
        # to someone who doesn't own it.
        if not result or result.user_id != current_user.id:
            logger.warning(f"Incident_records with id {id} not found")
            raise HTTPException(status_code=404, detail="Incident_records not found")

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching incident_records {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Incident_recordsResponse, status_code=201)
async def create_incident_records(
    data: Incident_recordsData,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Create a new incident_records, owned by the caller."""
    logger.debug(f"Creating new incident_records with data: {data}")

    service = Incident_recordsService(db)
    try:
        # user_id is set server-side — never trust a client-supplied value.
        result = await service.create({**data.model_dump(), "user_id": current_user.id})
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create incident_records")
        
        logger.info(f"Incident_records created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating incident_records: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating incident_records: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Incident_recordsResponse], status_code=201)
async def create_incident_recordss_batch(
    request: Incident_recordsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Create multiple incident_recordss in a single request, all owned by the caller."""
    logger.debug(f"Batch creating {len(request.items)} incident_recordss")

    service = Incident_recordsService(db)
    results = []

    try:
        for item_data in request.items:
            result = await service.create({**item_data.model_dump(), "user_id": current_user.id})
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} incident_recordss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Incident_recordsResponse])
async def update_incident_recordss_batch(
    request: Incident_recordsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Update multiple incident_recordss in a single request. Items not owned
    by the caller are silently skipped (same as "not found" elsewhere here)."""
    logger.debug(f"Batch updating {len(request.items)} incident_recordss")

    service = Incident_recordsService(db)
    results = []

    try:
        for item in request.items:
            existing = await service.get_by_id(item.id)
            if not existing or existing.user_id != current_user.id:
                continue
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} incident_recordss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Incident_recordsResponse)
async def update_incident_records(
    id: int,
    data: Incident_recordsUpdateData,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Update an existing incident_records, owned by the caller."""
    logger.debug(f"Updating incident_records {id} with data: {data}")

    service = Incident_recordsService(db)
    try:
        existing = await service.get_by_id(id)
        if not existing or existing.user_id != current_user.id:
            logger.warning(f"Incident_records with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Incident_records not found")

        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Incident_records with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Incident_records not found")

        logger.info(f"Incident_records {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating incident_records {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating incident_records {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_incident_recordss_batch(
    request: Incident_recordsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Delete multiple incident_recordss by their IDs. Items not owned by the
    caller are silently skipped (same as "not found" elsewhere here)."""
    logger.debug(f"Batch deleting {len(request.ids)} incident_recordss")

    service = Incident_recordsService(db)
    deleted_count = 0

    try:
        for item_id in request.ids:
            existing = await service.get_by_id(item_id)
            if not existing or existing.user_id != current_user.id:
                continue
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} incident_recordss successfully")
        return {"message": f"Successfully deleted {deleted_count} incident_recordss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_incident_records(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Delete a single incident_records by ID, owned by the caller."""
    logger.debug(f"Deleting incident_records with id: {id}")

    service = Incident_recordsService(db)
    try:
        existing = await service.get_by_id(id)
        if not existing or existing.user_id != current_user.id:
            logger.warning(f"Incident_records with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Incident_records not found")

        success = await service.delete(id)
        if not success:
            logger.warning(f"Incident_records with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Incident_records not found")

        logger.info(f"Incident_records {id} deleted successfully")
        return {"message": "Incident_records deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting incident_records {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")