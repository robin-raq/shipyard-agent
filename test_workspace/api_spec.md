# API Specification: Health Endpoint

## GET /health

Returns the health status of the API server.

### Response

- **Status:** 200 OK
- **Content-Type:** application/json

```json
{
  "status": "healthy",
  "uptime": 12345,
  "version": "1.0.0"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| status | string | Always "healthy" if the server is responding |
| uptime | number | Server uptime in seconds since start |
| version | string | Application version from package.json |

### Notes

- This endpoint requires no authentication
- Should respond within 100ms
- Used by load balancers and monitoring tools
