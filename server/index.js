// ─────────────────────────────────────────────
// 0. ENVIRONMENT SETUP (Must be at the very top!)
// ─────────────────────────────────────────────
import dotenv from "dotenv";
dotenv.config();
import 'dotenv/config';
import express from "express";
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import compression from "compression";
import rateLimit from "express-rate-limit";
import passport from "passport";
import session from "express-session";
import { createServer } from "http";
import { createClient } from "redis";

// Config & Services
import connectDB from "./config/DB.js";
import "./config/passport.js";
import redisClient from "./config/redis.js";

// Socket Imports
import { initBookingSocket } from './services/bookingSocketService.js';
import {
  registerConsultationSocket,
  setConsultationNamespace
} from "./sockets/consultationSocket.js";

// Route Imports
import userRouter               from "./routes/userRoutes.js";
import notificationRouter       from "./routes/notificationRoutes.js";
import hospitalRoutes           from "./routes/hospitalRoutes.js";
import uploadRoutes             from "./routes/uploadRoutes.js";
import adRouter                 from "./routes/advertisementRoutes.js";
import bannerRouter             from "./routes/bannerRoutes.js";
import subscriptionRouter       from "./routes/subscriptionPlanRoutes.js";
import usersubscriptionRouter   from "./routes/userSubscriptionPlan.js";
import transportPartnerRouter   from "./routes/Transportpartnerroutes.js";
import meetingRoutes            from "./routes/meetingRoutes.js";
import userManagerRoutes        from "./routes/super-admin/userManagementRoutes.js";
import medicinesRoutes          from "./routes/medicineRoutes.js";
import faqsRoutes               from "./routes/faqROutes.js";
import couponsRoutes            from "./routes/couponRoutes.js";
// import chatRoutes               from "./routes/chatRoutes.js";
import orderPharmacyRoutes      from "./routes/orderRoutes.js";
import pharmacyRoutes           from "./routes/pharmacyRoutes.js";
import walletRoutes             from "./routes/walletRoutes.js";
import superadminRoutes         from "./routes/super-admin/superadminRoutes.js";
import legalRoutes              from "./routes/Legalroutes.js";
import marqueeRoutes            from "./routes/marqueeRoutes.js";
import heroRoutes               from "./routes/heroPageRouter.js";
import pharmacyStoreRoutes      from "./routes/pharmacy/Pharmacystoreroutes.js";
import customerUserRouter       from "./routes/customer/Customeruserroutes.js";
import AdminUserRoutes          from "./routes/super-admin/adminUserRoutes.js";
import referralRouter           from "./routes/referralRoutes.js";
import pricingRouter            from './routes/Platformpricingroutes.js';
import soloDriverRouter         from './routes/solordriverRoutes.js';
import careAssistantRouter      from './routes/careassistantRoutes.js';
import driverRouter             from './routes/driverRouter.js';
 
import labRoutes                from './routes/labRoutes.js';
import bookingRoutes            from './routes/bookingRoutes.js';
import customerBookingRouter    from './routes/customerbookingrouter.js';
import hospitalManagerRouter    from './routes/hospitalManagerRouter.js';
import availabilityRouter       from './routes/availabilityRouter.js';
import booking1Routes           from './routes/bookingrouterpaert1.js';
import rideRequestRouter        from './routes/rideRequestRouter.js';
import rideOperationsRoutes     from './routes/rideOperationsRouter.js'
import prescriptionCareRouter   from './routes/prescriptionCareRouter.js';
import bloodBankRouter          from './routes/bloodbankRouter.js';
import adminAnalyticsRouter     from './routes/super-admin/adminanalyticsRouter.js';
import consultationRouter       from './routes/consultationrouter.js';
import { protect, authorize }   from "./middleware/authMiddleware.js";
import labPartnerRoutes         from './routes/labpartnerbookingRoutes.js';
import partnerWalletRoutes      from './routes/partnerWalletRouter.js';
import payoutRouter             from './routes/payoutRouter.js';
import bookingPayAtServiceRouter from './routes/bookingPayAtServiceRouter.js';
import accountingRouter         from './routes/accountingRouter.js';
import earningsRouter from './routes/earningsRouter.js';
 

import conversationRoutes from './routes/conversationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import attachmentRoutes from './routes/attachmentRoutes.js';

// ─────────────────────────────────────────────
// 1. CORE CONFIGURATION
// ─────────────────────────────────────────────
const app = express();
const server = createServer(app);

const PORT    = process.env.PORT    || 5050;
const NODE_ENV = process.env.NODE_ENV || "development";

app.set("trust proxy", 1);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(compression());

// ─────────────────────────────────────────────
// 2. SECURITY & CORS
// ─────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Blocked by CORS"));
      }
    },
    credentials: true,
  })
);

// ─────────────────────────────────────────────
// 3. SESSION & AUTHENTICATION
// ─────────────────────────────────────────────
if (NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET missing in production");
}

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: NODE_ENV === "production",
      httpOnly: true,
      sameSite: NODE_ENV === "production" ? "none" : "lax",
      maxAge: 86400000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ─────────────────────────────────────────────
// 4. LOGGING & RATE LIMITING
// ─────────────────────────────────────────────
app.use(morgan(NODE_ENV === "development" ? "dev" : "combined"));

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests, please try again later.",
    },
  })
);

// ─────────────────────────────────────────────
// 5. io → req BRIDGE
// Inject io into every request so route files can emit socket events.
// Must be declared before routes.
// ─────────────────────────────────────────────
app.use((req, _res, next) => {
  req.io = app.get("io");
  next();
});

// ─────────────────────────────────────────────
// 6. ROUTES
// ─────────────────────────────────────────────
app.use("/api/users",              userRouter);
app.use("/api/notifications",      notificationRouter);
app.use("/api/hospitals",          hospitalRoutes);
app.use("/api/upload",             uploadRoutes);
app.use("/api/ads",                adRouter);
app.use("/api/banners",            bannerRouter);
app.use("/api/plans",              subscriptionRouter);
app.use("/api/subscriptions",      usersubscriptionRouter);
app.use("/api/meetings",           meetingRoutes);
app.use("/api/user-management",    userManagerRoutes);
app.use("/api/medicines",          medicinesRoutes);
app.use("/api/faqs",               faqsRoutes);
app.use("/api/coupons",            couponsRoutes);
// app.use("/api/chat",               chatRoutes);
app.use("/api/user/pharmacy",      orderPharmacyRoutes);
app.use("/api/pharmacy",           pharmacyRoutes);
app.use("/api/wallet",             walletRoutes);
app.use("/api/superadmin",         superadminRoutes);
app.use("/api/legal",              legalRoutes);
app.use("/api/marquee",            marqueeRoutes);
app.use("/api/hero",               heroRoutes);
app.use("/api/pharmacy-store",     pharmacyStoreRoutes);
app.use("/api/customer",           customerUserRouter);
app.use("/api/admin/users",        AdminUserRoutes);
app.use("/api/transport",          transportPartnerRouter);
app.use("/api/referral",           referralRouter);
app.use("/api/pricing",            pricingRouter);
app.use("/api/solo-driver",        soloDriverRouter);
app.use("/api/care-assistant",     careAssistantRouter);
app.use("/api/driver",             driverRouter);
 
app.use("/api/labs",               labRoutes);
app.use("/api/hospital-manager",   hospitalManagerRouter);
app.use("/api/availability",       availabilityRouter);
app.use("/api/ride-requests",      rideRequestRouter);
app.use("/api/ride-ops",           rideOperationsRoutes);
app.use("/api/clinical",           prescriptionCareRouter);
app.use("/api/blood-banks",        bloodBankRouter);
app.use("/api/admin/analytics",    adminAnalyticsRouter);
app.use("/api/consultations",      consultationRouter);
app.use('/api/lab-partner/bookings', protect, authorize('lab_partner'), labPartnerRoutes);
app.use('/api/partner-wallet',     partnerWalletRoutes);

// ⚠️ Warning: Three separate routers mounted to the exact same path
// Consider combining these into a single router file in the future to avoid unexpected routing conflicts.
app.use("/api/bookings",           bookingRoutes);
app.use("/api/bookings",           customerBookingRouter);
app.use("/api/bookings",           booking1Routes);
app.use('/api/bookings',           bookingPayAtServiceRouter);
app.use('/api/accounting',         accountingRouter);
app.use('/api/payouts',            payoutRouter);


app.use('/api/earnings', earningsRouter);


app.use('/conversations', conversationRoutes);
app.use('/messages', messageRoutes);
app.use('/groups', groupRoutes);
app.use('/complaints', complaintRoutes);
app.use('/attachments', attachmentRoutes);

 

// ─────────────────────────────────────────────
// 7. HEALTH CHECK & ERROR HANDLING
// ─────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "Likeson API",
    status: "Live",
    redis: redisClient?.isReady || false,
    env: NODE_ENV,
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ─────────────────────────────────────────────
// 8. SERVER BOOTSTRAP
// ─────────────────────────────────────────────
async function startServer() {
  try {
    // ─────────────────────────────────────────────
    // 1. Connect MongoDB
    // ─────────────────────────────────────────────
    await connectDB();
    console.log("✅ MongoDB Connected");

    // ─────────────────────────────────────────────
    // 2. Validate Redis URL
    // ─────────────────────────────────────────────
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is missing.");
    }

    console.log(
      "🔌 Redis URL:",
      redisUrl.replace(/:(.*?)@/, ":********@")
    );

    // ─────────────────────────────────────────────
    // 3. Create Redis Pub/Sub Clients
    // ─────────────────────────────────────────────
    const pubClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 10000,

        reconnectStrategy(retries) {
          if (retries > 10) {
            console.error("❌ Redis reconnect limit reached.");
            return new Error("Redis reconnect limit reached");
          }

          return Math.min(retries * 200, 3000);
        },
      },
    });

    const subClient = pubClient.duplicate();

    // ─────────────────────────────────────────────
    // 4. Redis Events
    // ─────────────────────────────────────────────
    const registerEvents = (client, name) => {
      client.on("connect", () => {
        console.log(`🔌 ${name} connecting...`);
      });

      client.on("ready", () => {
        console.log(`✅ ${name} ready`);
      });

      client.on("reconnecting", () => {
        console.log(`🔄 ${name} reconnecting...`);
      });

      client.on("end", () => {
        console.log(`⚠️ ${name} disconnected`);
      });

      client.on("error", (err) => {
        console.error(`❌ ${name} Error:`, err);
      });
    };

    registerEvents(pubClient, "Redis Pub");
    registerEvents(subClient, "Redis Sub");

    // ─────────────────────────────────────────────
    // 5. Connect Redis
    // ─────────────────────────────────────────────
    console.log("Connecting Redis Pub...");
    await pubClient.connect();

    console.log("Connecting Redis Sub...");
    await subClient.connect();

    const pubPing = await pubClient.ping();
    const subPing = await subClient.ping();

    console.log("🏓 Pub Ping:", pubPing);
    console.log("🏓 Sub Ping:", subPing);

    console.log("✅ Redis authentication successful.");

    // ─────────────────────────────────────────────
    // 6. Socket.IO
    // ─────────────────────────────────────────────
    const io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        credentials: true,
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    });

    // Redis Adapter
    io.adapter(createAdapter(pubClient, subClient));

    // ─────────────────────────────────────────────
    // 7. Register Namespaces
    // ─────────────────────────────────────────────
    initBookingSocket(io);

    const consultationNs = registerConsultationSocket(io);
    setConsultationNamespace(consultationNs);

 
    
    app.set("io", io);

    // ─────────────────────────────────────────────
    // 7.5 Background Workers & Queues
    // ─────────────────────────────────────────────
  
  
    console.log("✅ Support workers & SLA sweeps initialized");

    // ─────────────────────────────────────────────
    // 8. Start Server
    // ─────────────────────────────────────────────
    server.listen(PORT, "0.0.0.0", () => {
      console.log("====================================");
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment : ${NODE_ENV}`);
      console.log(`🎫 Support Socket : Enabled`);
      console.log(`📡 Booking Socket : Enabled`);
      console.log(`🩺 Consultation Socket : Enabled`);
      console.log(`🔴 Redis Adapter : Connected`);
      console.log("====================================");
    });
  } catch (error) {
    console.error("====================================");
    console.error("❌ SERVER STARTUP FAILED");
    console.error(error);
    console.error("====================================");
    process.exit(1);
  }
}

startServer();

// ─────────────────────────────────────────────
// 9. GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────
process.on("SIGTERM", async () => {
  console.log("SIGTERM received");
  server.close(async () => {
    try {
      if (redisClient) await redisClient.quit();
    } catch {}
    process.exit(0);
  });
});