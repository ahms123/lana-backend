require("dotenv").config();
require("express-async-errors");
const express = require("express");
const app = express();
const cors = require("cors");
const helmet = require("helmet");
const xss = require("xss-clean");

// Security & basic middleware
app.use(helmet());
app.use(xss());
// dev: allows requests from your phone (you can tighten this in production)
app.use(cors());

const authRouter = require("./routes/auth");
const meRouter = require("./routes/me");
const walletRouter = require("./routes/wallet");
const tasksRouter = require("./routes/tasks");
const frensRouter = require("./routes/frens");
const earnRouter = require("./routes/earn");
const claimRouter = require("./routes/claim");

// useful checks (don't log secrets themselves)
console.log("JWT_SECRET present:", !!process.env.JWT_SECRET);
console.log(
  "JWT_RESET_SECRET present:",
  !!(process.env.JWT_RESET_SECRET || process.env.JWT_SECRET)
);
console.log("MONGO_URI present:", !!process.env.MONGO_URI);

// error handler
const notFoundMiddleware = require("./middleware/not-found");
const errorHandlerMiddleware = require("./middleware/error-handler");

app.use(express.json());
// extra packages
const connectDB = require("./db/connect");
const { migrateWalletAddressIndex } = require("./db/migrateWalletIndexes");

// routes
app.get("/", (req, res) => {
  res.json({ service: "lana-api", status: "ok" });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/me", meRouter);
app.use("/api/v1/wallet", walletRouter);
app.use("/api/v1/tasks", tasksRouter);
app.use("/api/v1/frens", frensRouter);
app.use("/api/v1/earn", earnRouter);
app.use("/api/v1/claim", claimRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const start = async () => {
  try {
    // required env checks
    if (!process.env.MONGO_URI) {
      console.error("Missing required env var: MONGO_URI");
      process.exit(1);
    }
    if (!process.env.JWT_SECRET) {
      console.warn("Warning: JWT_SECRET not set. Set this in production!");
    }

    await connectDB(process.env.MONGO_URI);
    await migrateWalletAddressIndex();

    const port = process.env.PORT || 3000;

    const server = app.listen(port, "0.0.0.0", () =>
      console.log(`Server is listening on http://0.0.0.0:${port}`)
    );

    // graceful shutdown on SIGTERM (Render sends SIGTERM on deploy)
    process.on("SIGTERM", () => {
      console.log("SIGTERM received. Closing server...");
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    });

    // handle unhandled promise rejections
    process.on("unhandledRejection", (err) => {
      console.error("Unhandled Rejection:", err);
      server.close(() => process.exit(1));
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

start();

module.exports = app; // exporting app can be useful for tests
