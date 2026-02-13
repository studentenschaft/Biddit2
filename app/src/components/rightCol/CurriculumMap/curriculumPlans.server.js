/**
 * Curriculum Plans API
 *
 * Move this file to your server:
 * - Model section → models/CurriculumPlan.js
 * - Routes section → routes/curriculumPlans.js
 * - Register in app.js: app.use("/curriculum-plans", require("./routes/curriculumPlans"));
 */

// ============================================================================
// MODEL: models/CurriculumPlan.js
// ============================================================================

const mongoose = require("mongoose");

const placementSchema = new mongoose.Schema(
  {
    placementId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["course", "placeholder"],
      required: true,
    },
    semester: {
      type: String,
      required: true,
    },
    categoryPath: {
      type: String,
      required: true,
    },
    // Course-specific fields
    courseId: {
      type: String,
    },
    shortName: {
      type: String,
    },
    // Placeholder-specific fields
    label: {
      type: String,
    },
    credits: {
      type: Number,
    },
    // Optional user note
    note: {
      type: String,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const planSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastModified: {
      type: Date,
      default: Date.now,
    },
    placements: [placementSchema],
  },
  { _id: false },
);

const curriculumPlanSchema = new mongoose.Schema({
  userHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  activePlanId: {
    type: String,
    default: "plan-default",
  },
  plans: [planSchema],
});

const CurriculumPlan = mongoose.model("CurriculumPlan", curriculumPlanSchema);

// ============================================================================
// ROUTES: routes/curriculumPlans.js
// ============================================================================

const express = require("express");
const bcrypt = require("bcryptjs");
const createHttpError = require("http-errors");

const auth = require("../middleware/auth");
const hsgOnly = require("../middleware/hsgOnly");
const bidditOrAdmin = require("../middleware/bidditOrAdmin");

const router = express.Router();

// Generate hash from user OID (same pattern as studyPlans)
const generateHash = (oid) => {
  return bcrypt.hash(oid, process.env.STUDYPLANS_SECRET);
};

// Helper to format response (always return full state)
const formatResponse = (curriculumPlan) => {
  return {
    activePlanId: curriculumPlan.activePlanId,
    plans: curriculumPlan.plans.reduce((acc, plan) => {
      acc[plan.planId] = {
        name: plan.name,
        createdAt: plan.createdAt,
        lastModified: plan.lastModified,
        placements: plan.placements,
      };
      return acc;
    }, {}),
  };
};

// Middleware: Get or create curriculum plan for authenticated user
const getCurriculumPlan = async (req, res, next) => {
  try {
    if (!req.user) {
      throw createHttpError(401, "User must be authenticated");
    }

    if (!req.user.oid) {
      throw createHttpError(401, "User must be a HSG member");
    }

    const userHash = await generateHash(req.user.oid);
    let curriculumPlan = await CurriculumPlan.findOne({ userHash });

    if (!curriculumPlan) {
      // Create default plan on first access
      curriculumPlan = await CurriculumPlan.create({
        userHash,
        activePlanId: "plan-default",
        plans: [
          {
            planId: "plan-default",
            name: "My Plan",
            createdAt: new Date(),
            lastModified: new Date(),
            placements: [],
          },
        ],
      });
    }

    req.curriculumPlan = curriculumPlan;
    next();
  } catch (err) {
    next(err);
  }
};

// GET / - Get full curriculum plan state
router.get("/", [auth, hsgOnly, getCurriculumPlan], async (req, res, next) => {
  try {
    res.json(formatResponse(req.curriculumPlan));
  } catch (err) {
    next(err);
  }
});

// POST / - Bulk replace all plans (full sync)
router.post("/", [auth, hsgOnly, getCurriculumPlan], async (req, res, next) => {
  try {
    const { activePlanId, plans } = req.body;

    if (!plans || typeof plans !== "object") {
      throw createHttpError(400, "Missing or invalid plans object");
    }

    const { curriculumPlan } = req;

    // Convert plans object to array
    const plansArray = Object.entries(plans).map(([planId, planData]) => ({
      planId,
      name: planData.name || "Untitled Plan",
      createdAt: planData.createdAt || new Date(),
      lastModified: new Date(),
      placements: planData.placements || [],
    }));

    curriculumPlan.plans = plansArray;
    curriculumPlan.activePlanId =
      activePlanId || plansArray[0]?.planId || "plan-default";

    await curriculumPlan.save();
    res.json(formatResponse(curriculumPlan));
  } catch (err) {
    next(err);
  }
});

// POST /reset - Clear all plans (requires bidditOrAdmin)
router.post(
  "/reset",
  [auth, hsgOnly, bidditOrAdmin, getCurriculumPlan],
  async (req, res, next) => {
    try {
      const { curriculumPlan } = req;

      curriculumPlan.activePlanId = "plan-default";
      curriculumPlan.plans = [
        {
          planId: "plan-default",
          name: "My Plan",
          createdAt: new Date(),
          lastModified: new Date(),
          placements: [],
        },
      ];

      await curriculumPlan.save();
      res.json(formatResponse(curriculumPlan));
    } catch (err) {
      next(err);
    }
  },
);

// POST /active/:planId - Set active plan
router.post(
  "/active/:planId",
  [auth, hsgOnly, getCurriculumPlan],
  async (req, res, next) => {
    try {
      const { planId } = req.params;
      const { curriculumPlan } = req;

      const planExists = curriculumPlan.plans.some((p) => p.planId === planId);
      if (!planExists) {
        throw createHttpError(404, "Plan not found");
      }

      curriculumPlan.activePlanId = planId;
      await curriculumPlan.save();
      res.json(formatResponse(curriculumPlan));
    } catch (err) {
      next(err);
    }
  },
);

// POST /:planId - Create or update plan metadata
router.post(
  "/:planId",
  [auth, hsgOnly, getCurriculumPlan],
  async (req, res, next) => {
    try {
      const { planId } = req.params;
      const { name, placements } = req.body;
      const { curriculumPlan } = req;

      const planIndex = curriculumPlan.plans.findIndex(
        (p) => p.planId === planId,
      );

      if (planIndex === -1) {
        // Create new plan
        curriculumPlan.plans.push({
          planId,
          name: name || "New Plan",
          createdAt: new Date(),
          lastModified: new Date(),
          placements: placements || [],
        });
      } else {
        // Update existing plan
        if (name !== undefined) {
          curriculumPlan.plans[planIndex].name = name;
        }
        if (placements !== undefined) {
          curriculumPlan.plans[planIndex].placements = placements;
        }
        curriculumPlan.plans[planIndex].lastModified = new Date();
      }

      await curriculumPlan.save();
      res.json(formatResponse(curriculumPlan));
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:planId - Delete a plan
router.delete(
  "/:planId",
  [auth, hsgOnly, getCurriculumPlan],
  async (req, res, next) => {
    try {
      const { planId } = req.params;
      const { curriculumPlan } = req;

      if (curriculumPlan.plans.length <= 1) {
        throw createHttpError(400, "Cannot delete the only remaining plan");
      }

      curriculumPlan.plans = curriculumPlan.plans.filter(
        (p) => p.planId !== planId,
      );

      // If deleted plan was active, switch to first available
      if (curriculumPlan.activePlanId === planId) {
        curriculumPlan.activePlanId = curriculumPlan.plans[0].planId;
      }

      await curriculumPlan.save();
      res.json(formatResponse(curriculumPlan));
    } catch (err) {
      next(err);
    }
  },
);

// POST /:planId/duplicate - Clone plan with new name
router.post(
  "/:planId/duplicate",
  [auth, hsgOnly, getCurriculumPlan],
  async (req, res, next) => {
    try {
      const { planId } = req.params;
      const { name } = req.body;
      const { curriculumPlan } = req;

      const sourcePlan = curriculumPlan.plans.find((p) => p.planId === planId);
      if (!sourcePlan) {
        throw createHttpError(404, "Plan not found");
      }

      const newPlanId = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newPlan = {
        planId: newPlanId,
        name: name || `${sourcePlan.name} (Copy)`,
        createdAt: new Date(),
        lastModified: new Date(),
        placements: sourcePlan.placements.map((p) => ({
          ...p,
          placementId: `${p.placementId}-copy-${Date.now()}`,
        })),
      };

      curriculumPlan.plans.push(newPlan);
      await curriculumPlan.save();
      res.json(formatResponse(curriculumPlan));
    } catch (err) {
      next(err);
    }
  },
);

// POST /:planId/:placementId - Add or update single placement
router.post(
  "/:planId/:placementId",
  [auth, hsgOnly, getCurriculumPlan],
  async (req, res, next) => {
    try {
      const { planId, placementId } = req.params;
      const {
        type,
        semester,
        categoryPath,
        courseId,
        shortName,
        label,
        credits,
        note,
      } = req.body;
      const { curriculumPlan } = req;

      // Validate required fields
      if (!type || !semester || !categoryPath) {
        throw createHttpError(
          400,
          "Missing required fields: type, semester, categoryPath",
        );
      }

      if (type === "course" && !courseId) {
        throw createHttpError(400, "courseId is required for type 'course'");
      }

      if (type === "placeholder" && (credits === undefined || !label)) {
        throw createHttpError(
          400,
          "credits and label are required for type 'placeholder'",
        );
      }

      const planIndex = curriculumPlan.plans.findIndex(
        (p) => p.planId === planId,
      );
      if (planIndex === -1) {
        throw createHttpError(404, "Plan not found");
      }

      const plan = curriculumPlan.plans[planIndex];
      const placementIndex = plan.placements.findIndex(
        (p) => p.placementId === placementId,
      );

      const placementData = {
        placementId,
        type,
        semester,
        categoryPath,
        courseId: type === "course" ? courseId : undefined,
        shortName: type === "course" ? shortName : undefined,
        label: type === "placeholder" ? label : undefined,
        credits: type === "placeholder" ? credits : undefined,
        note: note || undefined,
        addedAt:
          placementIndex === -1
            ? new Date()
            : plan.placements[placementIndex].addedAt,
      };

      if (placementIndex === -1) {
        // Add new placement
        plan.placements.push(placementData);
      } else {
        // Update existing placement
        plan.placements[placementIndex] = placementData;
      }

      plan.lastModified = new Date();
      await curriculumPlan.save();
      res.json(formatResponse(curriculumPlan));
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:planId/:placementId - Remove single placement
router.delete(
  "/:planId/:placementId",
  [auth, hsgOnly, getCurriculumPlan],
  async (req, res, next) => {
    try {
      const { planId, placementId } = req.params;
      const { curriculumPlan } = req;

      const planIndex = curriculumPlan.plans.findIndex(
        (p) => p.planId === planId,
      );
      if (planIndex === -1) {
        throw createHttpError(404, "Plan not found");
      }

      curriculumPlan.plans[planIndex].placements = curriculumPlan.plans[
        planIndex
      ].placements.filter((p) => p.placementId !== placementId);
      curriculumPlan.plans[planIndex].lastModified = new Date();

      await curriculumPlan.save();
      res.json(formatResponse(curriculumPlan));
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
