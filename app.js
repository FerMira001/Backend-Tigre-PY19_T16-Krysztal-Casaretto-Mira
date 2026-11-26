import express from 'express'
import 'dotenv/config';
import connectDB from './v1/config/db.config.js'
import cors from 'cors'

import v1Router from './v1/index.js';
import { notFoundMiddleware } from './v1/middlewares/notFound.middleware.js';
import { errorMiddleware } from './v1/middlewares/error.middleware.js';

connectDB();

const app = express()

// Origen permitido: la URL del front (la misma que arma el enlace de recuperación de contraseña)
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }))

app.use(express.json({ limit: '1mb' })) // Una estantería con todas sus posiciones puede superar los 100 KB por defecto

app.use('/v1', v1Router)

app.use(notFoundMiddleware)
app.use(errorMiddleware)


export default app
