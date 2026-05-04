# NexusEdu API Reference

## Base URL
Production: `https://api.nexusedu.io/api/v1`
Development: `http://localhost:8080/api/v1`

## Authentication
All protected endpoints require a Bearer token in the Authorization header.
`Authorization: Bearer <JWT_TOKEN>`

## Endpoints

### Catalog
#### `GET /catalog/subjects`
Returns a list of available subjects.
**Response**: `200 OK`
```json
{
  "data": [
    { "id": "sub_1", "name": "Physics", "slug": "physics" }
  ]
}
```

#### `GET /catalog/subjects/{slug}/chapters`
**Response**: `200 OK`

### Video Streaming
#### `GET /stream/{video_id}`
Streams video content. 
**Headers**: `Range: bytes=0-`
**Response**: `206 Partial Content` (Video binary chunk)

### Progress Tracking
#### `POST /progress/video/{video_id}`
Updates watch progress.
**Payload**:
```json
{
  "progress_seconds": 120,
  "completed": false
}
```

### Real-time / Live Classes
#### `GET /live/classes`
Returns upcoming and active live classes.

---
**Note**: Interactive API documentation (Swagger/OpenAPI) is available at `/docs` on the active backend server.
