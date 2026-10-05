import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { z } from "zod"
import {
  AppToast,
  BoundFormField,
  Button,
  FormInputSlug,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dropx/ui"
import { RECORD_STATUSES } from "@dropx/types"
import { FormSheet } from "@/components/form-sheet"
import { ReferenceCombobox } from "@/components/reference-combobox"
import { createRoute, listRouteStops, replaceRouteStops, updateRoute } from "@/lib/endpoints"
import {
  createRouteSchema,
  type CreateRouteBody,
  type Route,
  type RouteStopInput,
  type UpdateRouteBody,
} from "@/lib/types"

const schema = createRouteSchema

const BLANK: z.infer<typeof schema> = {
  name: "",
  code: "",
  originHubId: "",
  destinationHubId: "",
  distanceKm: undefined,
  estimatedMinutes: undefined,
  status: "ACTIVE",
}

export function RouteFormSheet({
  open,
  onOpenChange,
  route,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  route?: Route | null
}) {
  const queryClient = useQueryClient()
  const routeId = route?.id
  const [stops, setStops] = useState<RouteStopInput[]>([])

  const defaults: z.infer<typeof schema> = route
    ? {
        name: route.name,
        code: route.code,
        originHubId: route.originHubId,
        destinationHubId: route.destinationHubId,
        distanceKm: route.distanceKm ?? undefined,
        estimatedMinutes: route.estimatedMinutes ?? undefined,
        status: route.status,
      }
    : BLANK

  const stopsQuery = useQuery({
    queryKey: ["route-stops", routeId],
    queryFn: () => listRouteStops(routeId!),
    enabled: open && Boolean(routeId),
  })

  // Seed the editor from the server once per open; a later refetch must not
  // clobber reordering the user has already done.
  useEffect(() => {
    if (open && stopsQuery.data) {
      setStops(
        stopsQuery.data.map((stop) => ({
          hubId: stop.hubId,
          sequenceNo: stop.sequenceNo,
          estimatedArrivalMinutes: stop.estimatedArrivalMinutes,
        })),
      )
    }
    if (open && !routeId) setStops([])
  }, [open, routeId, stopsQuery.data])

  const mutation = useMutation({
    mutationFn: async (body: CreateRouteBody | UpdateRouteBody) => {
      const saved = route
        ? await updateRoute(route.id, body)
        : await createRoute(body as CreateRouteBody)

      // Stops need a saved route to hang off, so they ride the same submit.
      if (stops.length > 0) await replaceRouteStops(saved.id, stops)

      return saved
    },
    onSuccess: (saved) => {
      AppToast.success(route ? `${saved.name} updated` : `${saved.name} created`)
      void queryClient.invalidateQueries({ queryKey: ["routes"] })
      void queryClient.invalidateQueries({ queryKey: ["route-stops", saved.id] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title={route ? "Edit route" : "New route"}
      description="Hub-to-hub route, plus the ordered stops it passes through."
      submitLabel={route ? "Save route" : "Create route"}
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{
        name: "Name",
        code: "Code",
        originHubId: "Origin hub",
        destinationHubId: "Destination hub",
        distanceKm: "Distance (km)",
        estimatedMinutes: "Estimated minutes",
        status: "Status",
      }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof schema>
        await mutation.mutateAsync({
          ...typed,
          distanceKm: typed.distanceKm ?? null,
          estimatedMinutes: typed.estimatedMinutes ?? null,
        } as CreateRouteBody)
      }}
      error={null}
      renderFields={() => (
        <>
          <StopsEditor
            stops={stops}
            onChange={setStops}
            loading={stopsQuery.isPending && Boolean(routeId)}
            locked={!routeId}
          />

          <BoundFormField
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <Input placeholder="Dhaka to Chattogram" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormInputSlug name="code" inheritFrom="name" label="Code" placeholder="DHL-CGP" />
          <BoundFormField
            name="originHubId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Origin hub</FormLabel>
                <ReferenceCombobox
                  source="hubs"
                  placeholder="Select origin hub"
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="destinationHubId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Destination hub</FormLabel>
                <ReferenceCombobox
                  source="hubs"
                  placeholder="Select destination hub"
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <BoundFormField
              name="distanceKm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Distance (km)</FormLabel>
                  <Input type="number" step="0.01" min="0" placeholder="220.5" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <BoundFormField
              name="estimatedMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated minutes</FormLabel>
                  <Input type="number" step="1" min="0" placeholder="300" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <BoundFormField
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECORD_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status === "ACTIVE" ? "Active" : "Inactive"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    />
  )
}

/**
 * Stable ids for the stop rows so each control has a real `<label for>`.
 *
 * These rows deliberately do **not** use `FormLabel`/`FormItem`: those read
 * react-hook-form context through `useFormField()` and throw
 * "useFormField should be used within <FormField>" outside a bound field.
 * Stops are local state on an array, not registered form fields, so a plain
 * label wired by `htmlFor` is the correct pairing here.
 */
const hubFieldId = (index: number) => `route-stop-${index}-hub`
const arrivalFieldId = (index: number) => `route-stop-${index}-arrival`

/**
 * Ordered stops. `sequenceNo` is derived from row order, which is the only thing
 * the user actually controls — the DB enforces uniqueness on it, so the editor
 * renumbers on every insert, remove and move rather than trusting an input.
 */
function StopsEditor({
  stops,
  onChange,
  loading,
  locked,
}: {
  stops: RouteStopInput[]
  onChange: (stops: RouteStopInput[]) => void
  loading: boolean
  locked: boolean
}) {
  const addStop = () =>
    onChange([...stops, { hubId: "", sequenceNo: stops.length + 1, estimatedArrivalMinutes: null }])

  const update = (index: number, patch: Partial<RouteStopInput>) =>
    onChange(stops.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const remove = (index: number) =>
    onChange(stops.filter((_, i) => i !== index).map((row, i) => ({ ...row, sequenceNo: i + 1 })))

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= stops.length) return
    const next = [...stops]
    const [row] = next.splice(index, 1)
    if (!row) return
    next.splice(target, 0, row)
    onChange(next.map((r, i) => ({ ...r, sequenceNo: i + 1 })))
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Stops</h3>
          <p className="text-muted-foreground text-sm">
            {locked
              ? "Save the route first, then add the hubs it passes through."
              : "Hubs this route passes through, in order."}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addStop} disabled={locked}>
          <Plus />
          Add stop
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading stops…</p>
      ) : stops.length === 0 ? (
        <p className="text-muted-foreground text-sm">No stops yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {stops.map((row, index) => (
            <div key={index} className="flex items-end gap-2">
              <span className="text-muted-foreground w-6 pb-2 text-center text-sm tabular-nums">
                {index + 1}
              </span>
              <div className="flex-1">
                <label htmlFor={hubFieldId(index)} className="sr-only">
                  Stop {index + 1} hub
                </label>
                <ReferenceCombobox
                  id={hubFieldId(index)}
                  source="hubs"
                  placeholder="Select hub"
                  value={row.hubId}
                  onChange={(hubId) => update(index, { hubId })}
                />
              </div>
              <div className="w-32">
                <label htmlFor={arrivalFieldId(index)} className="sr-only">
                  Stop {index + 1} arrival in minutes
                </label>
                <Input
                  id={arrivalFieldId(index)}
                  type="number"
                  step="1"
                  min="0"
                  placeholder="60"
                  value={row.estimatedArrivalMinutes ?? ""}
                  onChange={(event) =>
                    update(index, {
                      estimatedArrivalMinutes: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Move stop ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Move stop ${index + 1} down`}
                disabled={index === stops.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove stop ${index + 1}`}
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
