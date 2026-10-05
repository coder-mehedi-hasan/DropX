import { validateJson, validateParam, validateQuery } from "../../core"
import { response } from "../../core/http"
import { defineOperation } from "../../shared/auth/policy"
import { PERMISSIONS } from "../../shared/auth/permissions"
import type { AppEnv } from "../../types/env"
import { Hono } from "hono"

import {
  createRouteSchema,
  listRoutesQuerySchema,
  routeIdParamSchema,
  updateRouteSchema,
  updateStopsSchema,
} from "./routes.dto"
import * as routesService from "./routes.service"

/**
 * Routes + stops CRUD for staff, hand-written like the pricing module.
 * Mounted under `/routes`.
 */
const router = new Hono<AppEnv>()

router.get(
  "/",
  defineOperation(
    { id: "admin.routes.list", audience: ["admin"], permissions: [PERMISSIONS.ROUTES_VIEW] },
    { method: "GET", path: "/routes" },
  ),
  validateQuery(listRoutesQuerySchema),
  async (c) => {
    const page = await routesService.listRoutes(c, c.req.valid("query"))
    return c.json(response.success(page))
  },
)

router.get(
  "/:id",
  defineOperation(
    { id: "admin.routes.read", audience: ["admin"], permissions: [PERMISSIONS.ROUTES_VIEW] },
    { method: "GET", path: "/routes/:id" },
  ),
  validateParam(routeIdParamSchema),
  async (c) => {
    const route = await routesService.readRoute(c, c.req.valid("param").id)
    return c.json(response.success(route))
  },
)

router.post(
  "/",
  defineOperation(
    { id: "admin.routes.create", audience: ["admin"], permissions: [PERMISSIONS.ROUTES_MANAGE] },
    { method: "POST", path: "/routes" },
  ),
  validateJson(createRouteSchema),
  async (c) => {
    const input = c.req.valid("json")
    const route = await routesService.createRoute(c, {
      ...input,
      distanceKm: input.distanceKm ?? null,
      estimatedMinutes: input.estimatedMinutes ?? null,
    })
    return c.json(response.success(route), 201)
  },
)

router.patch(
  "/:id",
  defineOperation(
    { id: "admin.routes.update", audience: ["admin"], permissions: [PERMISSIONS.ROUTES_MANAGE] },
    { method: "PATCH", path: "/routes/:id" },
  ),
  validateParam(routeIdParamSchema),
  validateJson(updateRouteSchema),
  async (c) => {
    const route = await routesService.updateRoute(c, c.req.valid("param").id, c.req.valid("json"))
    return c.json(response.success(route))
  },
)

router.delete(
  "/:id",
  defineOperation(
    { id: "admin.routes.delete", audience: ["admin"], permissions: [PERMISSIONS.ROUTES_MANAGE] },
    { method: "DELETE", path: "/routes/:id" },
  ),
  validateParam(routeIdParamSchema),
  async (c) => {
    await routesService.deleteRouteService(c, c.req.valid("param").id)
    return c.status(204)
  },
)

router.get(
  "/:id/stops",
  defineOperation(
    { id: "admin.routes.stopsList", audience: ["admin"], permissions: [PERMISSIONS.ROUTES_VIEW] },
    { method: "GET", path: "/routes/:id/stops" },
  ),
  validateParam(routeIdParamSchema),
  async (c) => {
    const stops = await routesService.listStops(c, c.req.valid("param").id)
    return c.json(response.success(stops))
  },
)

router.put(
  "/:id/stops",
  defineOperation(
    {
      id: "admin.routes.stopsReplace",
      audience: ["admin"],
      permissions: [PERMISSIONS.ROUTES_MANAGE],
    },
    { method: "PUT", path: "/routes/:id/stops" },
  ),
  validateParam(routeIdParamSchema),
  validateJson(updateStopsSchema),
  async (c) => {
    const stops = await routesService.updateRouteStops(
      c,
      c.req.valid("param").id,
      c.req.valid("json").stops,
    )
    return c.json(response.success(stops))
  },
)

export default router
