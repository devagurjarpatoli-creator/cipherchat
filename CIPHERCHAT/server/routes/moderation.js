const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

router.post('/report/user', async (req, res) => {
  const { reporterId, reportedUserId, reason, evidenceDetails } = req.body;
  try {
    const report = await prisma.userReport.create({
      data: { reporterId, reportedUserId, reason, evidenceDetails: evidenceDetails || '' }
    });
    res.json({ success: true, reportId: report.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/users/ban', async (req, res) => {
  const { userId, reason } = req.body;
  try {
    await prisma.user.update({ where: { id: userId }, data: { isBanned: true, banReason: reason } });
    res.json({ success: true, message: "User banned successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;