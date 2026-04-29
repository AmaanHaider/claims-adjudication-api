const swaggerUi = require("swagger-ui-express");

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Claims Adjudication API",
    version: "1.0.0",
    description:
      "API-only claims processing system that adjudicates insurance claim line items against policy coverage rules.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development",
    },
  ],
  tags: [
    { name: "Health" },
    { name: "Members" },
    { name: "Policies" },
    { name: "Claims" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          200: {
            description: "API is running",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "ok" } },
                },
              },
            },
          },
        },
      },
    },
    "/members": {
      get: {
        tags: ["Members"],
        summary: "List members",
        responses: {
          200: { description: "Members returned" },
        },
      },
    },
    "/members/{id}": {
      get: {
        tags: ["Members"],
        summary: "Get member by id",
        parameters: [{ $ref: "#/components/parameters/IdParam" }],
        responses: {
          200: { description: "Member returned" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/policies": {
      get: {
        tags: ["Policies"],
        summary: "List policies",
        responses: {
          200: { description: "Policies returned" },
        },
      },
    },
    "/policies/{id}": {
      get: {
        tags: ["Policies"],
        summary: "Get policy by id",
        parameters: [{ $ref: "#/components/parameters/IdParam" }],
        responses: {
          200: { description: "Policy returned" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/claims": {
      get: {
        tags: ["Claims"],
        summary: "List claims",
        responses: {
          200: { description: "Claims returned" },
        },
      },
      post: {
        tags: ["Claims"],
        summary: "Submit and adjudicate a claim",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SubmitClaimRequest" },
              example: {
                memberId: 1,
                providerName: "City Health Clinic",
                diagnosisCodes: ["M54.5"],
                lineItems: [
                  {
                    serviceType: "physical_therapy",
                    amountCents: 30000,
                    dateOfService: "2026-04-10",
                  },
                  {
                    serviceType: "dental",
                    amountCents: 15000,
                    dateOfService: "2026-04-10",
                  },
                  {
                    serviceType: "mri",
                    amountCents: 120000,
                    dateOfService: "2026-04-10",
                  },
                ],
              },
            },
          },
        },
        responses: {
          201: {
            description: "Claim created and adjudicated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Claim" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/UnprocessableEntity" },
        },
      },
    },
    "/claims/{id}": {
      get: {
        tags: ["Claims"],
        summary: "Get claim by id",
        parameters: [{ $ref: "#/components/parameters/IdParam" }],
        responses: {
          200: {
            description: "Claim returned with line items and decisions",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Claim" },
              },
            },
          },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/claims/{id}/review": {
      post: {
        tags: ["Claims"],
        summary: "Manually review a line item that needs review",
        parameters: [{ $ref: "#/components/parameters/IdParam" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReviewRequest" },
              example: {
                lineItemId: 123,
                decision: "approved",
                explanation: "Reviewed and approved based on submitted documentation.",
              },
            },
          },
        },
        responses: {
          200: { description: "Claim review updated" },
          400: { $ref: "#/components/responses/BadRequest" },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/UnprocessableEntity" },
        },
      },
    },
    "/claims/{id}/pay": {
      post: {
        tags: ["Claims"],
        summary: "Mark an approved or partially approved claim as paid",
        parameters: [{ $ref: "#/components/parameters/IdParam" }],
        responses: {
          200: { description: "Claim paid" },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/UnprocessableEntity" },
        },
      },
    },
    "/claims/{id}/dispute": {
      post: {
        tags: ["Claims"],
        summary: "Dispute a claim decision",
        parameters: [{ $ref: "#/components/parameters/IdParam" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DisputeRequest" },
              example: { reason: "I believe this service should be covered." },
            },
          },
        },
        responses: {
          200: { description: "Claim disputed" },
          400: { $ref: "#/components/responses/BadRequest" },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/UnprocessableEntity" },
        },
      },
    },
  },
  components: {
    parameters: {
      IdParam: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "integer", example: 1 },
      },
    },
    responses: {
      BadRequest: { description: "Invalid request body" },
      NotFound: { description: "Resource not found" },
      UnprocessableEntity: { description: "Request is valid but cannot be applied to current domain state" },
    },
    schemas: {
      SubmitClaimRequest: {
        type: "object",
        required: ["memberId", "providerName", "lineItems"],
        properties: {
          memberId: { type: "integer", example: 1 },
          providerName: { type: "string", example: "City Health Clinic" },
          diagnosisCodes: {
            type: "array",
            items: { type: "string" },
            example: ["M54.5"],
          },
          lineItems: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/SubmitClaimLineItem" },
          },
        },
      },
      SubmitClaimLineItem: {
        type: "object",
        required: ["serviceType", "amountCents", "dateOfService"],
        properties: {
          serviceType: {
            type: "string",
            example: "physical_therapy",
          },
          amountCents: { type: "integer", minimum: 0, example: 30000 },
          dateOfService: { type: "string", format: "date", example: "2026-04-10" },
        },
      },
      ReviewRequest: {
        type: "object",
        required: ["lineItemId", "decision", "explanation"],
        properties: {
          lineItemId: { type: "integer", example: 123 },
          decision: { type: "string", enum: ["approved", "denied"] },
          explanation: { type: "string" },
        },
      },
      DisputeRequest: {
        type: "object",
        required: ["reason"],
        properties: {
          reason: { type: "string", example: "I believe this should be covered." },
        },
      },
      Claim: {
        type: "object",
        properties: {
          id: { type: "integer" },
          memberId: { type: "integer" },
          providerName: { type: "string" },
          diagnosisCodes: { type: "array", items: { type: "string" } },
          status: {
            type: "string",
            enum: ["submitted", "under_review", "approved", "partially_approved", "denied", "paid", "disputed", "closed"],
          },
          totalSubmittedCents: { type: "integer" },
          totalPayableCents: { type: "integer" },
          ClaimLineItems: {
            type: "array",
            items: { $ref: "#/components/schemas/ClaimLineItem" },
          },
          ClaimDecisions: {
            type: "array",
            items: { $ref: "#/components/schemas/ClaimDecision" },
          },
        },
      },
      ClaimLineItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          claimId: { type: "integer" },
          serviceType: { type: "string" },
          amountCents: { type: "integer" },
          dateOfService: { type: "string", format: "date" },
          status: {
            type: "string",
            enum: ["submitted", "approved", "denied", "needs_review", "manually_approved", "manually_denied"],
          },
        },
      },
      ClaimDecision: {
        type: "object",
        properties: {
          id: { type: "integer" },
          claimId: { type: "integer" },
          claimLineItemId: { type: "integer" },
          coverageRuleId: { type: "integer", nullable: true },
          status: {
            type: "string",
            enum: ["approved", "denied", "needs_review", "manually_approved", "manually_denied"],
          },
          submittedAmountCents: { type: "integer" },
          allowedAmountCents: { type: "integer" },
          payableAmountCents: { type: "integer" },
          memberResponsibilityCents: { type: "integer" },
          explanation: { type: "string" },
        },
      },
    },
  },
};

function mountSwagger(app) {
  app.get("/api-docs.json", (req, res) => {
    res.status(200).json(openApiSpec);
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
}

module.exports = { mountSwagger, openApiSpec };
