import { Router } from "express";

const router = Router();
const startTime = Date.now();

router.get("/health", (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  res.json({
    status: "healthy",
    uptime: uptime,
    version: "1.0.0"
  });
});

router.get("/api/docs", (req, res) => {
  res.json({ message: "API documentation" });
});

// GET /api/documents/:id/comments - Return comments for a specific document
router.get("/api/documents/:id/comments", (req, res) => {
  const documentId = req.params.id;
  
  // Validate document ID
  if (!documentId || isNaN(Number(documentId))) {
    return res.status(400).json({
      error: "Invalid document ID",
      message: "Document ID must be a valid number"
    });
  }

  // Mock comments data - in production, this would query a database
  const comments = [
    {
      id: 1,
      documentId: Number(documentId),
      userId: 101,
      userName: "Alice Johnson",
      content: "This looks great! Just a few minor suggestions.",
      createdAt: "2024-01-15T10:30:00Z",
      updatedAt: "2024-01-15T10:30:00Z"
    },
    {
      id: 2,
      documentId: Number(documentId),
      userId: 102,
      userName: "Bob Smith",
      content: "Can we discuss the timeline in section 3?",
      createdAt: "2024-01-15T11:45:00Z",
      updatedAt: "2024-01-15T11:45:00Z"
    },
    {
      id: 3,
      documentId: Number(documentId),
      userId: 103,
      userName: "Carol Davis",
      content: "Approved. Ready to move forward.",
      createdAt: "2024-01-15T14:20:00Z",
      updatedAt: "2024-01-15T14:20:00Z"
    }
  ];

  res.json({
    documentId: Number(documentId),
    comments: comments,
    total: comments.length
  });
});

export default router;
