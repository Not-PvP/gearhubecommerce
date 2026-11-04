// entry point ka back ah
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import productsRouter from './routes/products';
import authRouter from './routes/auth';
import cartRouter from './routes/cart';
import ordersRouter from './routes/orders';
import adminRouter from './routes/admin';

dotenv.config();

const app = express(); // himo back web app
const PORT = process.env.PORT || 5000; 

app.use(cors()); // allow ya ang browser frontend nga mahimo request sa back
app.use(express.json()); // basa ya mga incoming JSON request para makaaccess and routes ka data

// connect URL prefixes to route files
app.use('/api/admin', adminRouter);
app.use('/api/auth', authRouter);
app.use('/api/cart', cartRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/products', productsRouter);

app.get('/api/health', (_req, res) => { // to check kung ga run mn gid
  res.status(200).json({ status: 'ok' });
});

// start na server sa nagabutang nga port
app.listen(PORT, () => {
  console.log(`GearHub API server running on http://localhost:${PORT}`);
});
