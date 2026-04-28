function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateClaimRequest(req, res, next) {
  const body = req.body;
  const errors = [];

  if (!isPlainObject(body)) {
    return res.status(400).json({ error: { message: "Request body must be an object" } });
  }

  if (!Number.isInteger(body.memberId)) {
    errors.push("memberId must be an integer");
  }

  if (typeof body.providerName !== "string" || body.providerName.trim().length === 0) {
    errors.push("providerName is required");
  }

  if (body.diagnosisCodes !== undefined) {
    if (!Array.isArray(body.diagnosisCodes) || body.diagnosisCodes.some((c) => typeof c !== "string")) {
      errors.push("diagnosisCodes must be an array of strings");
    }
  }

  if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
    errors.push("lineItems must be a non-empty array");
  } else {
    body.lineItems.forEach((li, idx) => {
      if (!isPlainObject(li)) {
        errors.push(`lineItems[${idx}] must be an object`);
        return;
      }
      if (typeof li.serviceType !== "string" || li.serviceType.trim().length === 0) {
        errors.push(`lineItems[${idx}].serviceType is required`);
      }
      if (!Number.isInteger(li.amountCents) || li.amountCents < 0) {
        errors.push(`lineItems[${idx}].amountCents must be a non-negative integer`);
      }
      if (typeof li.dateOfService !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(li.dateOfService)) {
        errors.push(`lineItems[${idx}].dateOfService must be YYYY-MM-DD`);
      }
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: { message: "Validation error", details: errors } });
  }

  next();
}

module.exports = { validateClaimRequest };
