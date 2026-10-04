const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/admin/wallets', async (req, res) => {
  const wallets = await prisma.ownerWallet.findMany();
  res.json({ success: true, wallets });
});

router.post('/admin/wallets/update', async (req, res) => {
  const { chain, address, label } = req.body;
  const wallet = await prisma.ownerWallet.upsert({
    where: { chain },
    update: { address, label },
    create: { chain, address, label }
  });
  res.json({ success: true, wallet });
});

module.exports = router;
