function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: "Not found",
      path: req.originalUrl,
    },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = Number.isInteger(err?.status) ? err.status : 500;
  const message = status === 500 ? "Internal server error" : err?.message || "Error";

  if (process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(status).json({
    error: {
      message,
    },
  });
}

module.exports = { notFoundHandler, errorHandler };
