import { Router } from "express";

const router = Router();

router.get("/api/docs", (req, res) => {
  res.json({ message: "API documentation" });
});

export default router;
