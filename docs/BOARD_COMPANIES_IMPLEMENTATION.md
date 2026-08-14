# Board Companies Feature - Implementation Summary

## Overview

Implemented database-backed company list management for ATS adapters (Phase 2.2).

## What Was Built

### Database Schema

- Added `BoardCompany` table to store company lists per adapter
- Fields: id, board, company_id, company_name, metadata, last_checked, success_count, failure_count, enabled
- Composite unique constraint on (board, company_id)
- Foreign key relationship to Board table

### Storage Layer

- Added methods to `Storage` interface:
  - `saveBoardCompany()` - Save single company
  - `listBoardCompanies()` - List with filtering
  - `getBoardCompany()` - Get by ID
  - `updateBoardCompany()` - Update single company
  - `deleteBoardCompany()` - Delete by ID
  - `bulkUpsertBoardCompanies()` - Bulk add/update with auto Board creation
  - `getBoardCompanyCounts()` - Get enabled/disabled counts

### API Endpoints

All endpoints mounted at `/api/boards`:

1. **GET /api/boards** - List all adapters with counts
2. **GET /api/boards/:adapter/companies** - List companies for adapter
3. **POST /api/boards/:adapter/companies** - Add/update companies (single or array)
4. **PUT /api/boards/:adapter/companies/:id** - Update single company
5. **DELETE /api/boards/:adapter/companies/:id** - Delete company

### Key Features

- **Automatic Board creation**: `bulkUpsertBoardCompanies()` auto-creates Board records if they don't exist
- **Upsert logic**: POST endpoint updates existing companies or creates new ones
- **Filtering**: List endpoints support filtering by board and enabled status
- **Counts**: Always return enabled/disabled/total counts

### Testing

- **327 tests passing** (298 original + 29 new)
- Added comprehensive test suite:
  - 18 API endpoint tests
  - 11 E2E storage tests
- All tests use both MockStorage and PrismaStorage

### Example Usage

```bash
# Add companies for Greenhouse
curl -X POST http://localhost:3000/api/boards/greenhouse/companies \
  -H "Content-Type: application/json" \
  -d '[
    {"company_id": "stripe", "company_name": "Stripe"},
    {"company_id": "figma", "company_name": "Figma"},
    {"company_id": "notion", "company_name": "Notion"}
  ]'

# List companies
curl http://localhost:3000/api/boards/greenhouse/companies

# Disable a company
curl -X PUT http://localhost:3000/api/boards/greenhouse/companies/{id} \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Get all boards with counts
curl http://localhost:3000/api/boards

# Fetch jobs from enabled companies
curl http://localhost:3000/api/boards/greenhouse/jobs?limit=10

# Trigger background company list update (Greenhouse only)
curl -X POST http://localhost:3000/api/boards/greenhouse/update
```

## Next Steps (Phase 2.3)

The adapters need to be updated to read company lists from the database instead of using hardcoded lists. Each adapter will:

1. Query `storage.listBoardCompanies({ board: adapterName, enabled: true })` on startup
2. Use the returned company IDs instead of hardcoded arrays
3. Support dynamic updates when companies are added/removed via API

This will enable the "background update" feature where company lists can be refreshed without code changes.
