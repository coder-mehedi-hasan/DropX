import { BookOpenText } from "lucide-react"
import { useState } from "react"
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@dropx/ui"

import { GLOSSARY_GROUPS } from "./glossary"

const firstGroupId = GLOSSARY_GROUPS[0]?.id ?? "operations"

/**
 * The global "what does this word mean" popup.
 *
 * One dialog, grouped into tabs, reachable from the header on every admin
 * screen. Grouped rather than one flat list so a confused dispatcher lands on
 * the right slice — the transfer-lifecycle tab talks in the exact language of
 * the row buttons (`FORWARD_ACTION`) on the Transfers page.
 */
export function HelpDialog() {
  const [activeGroup, setActiveGroup] = useState(firstGroupId)

  return (
    <Dialog onOpenChange={(open) => open && setActiveGroup(firstGroupId)}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Help and glossary"
          title="Help: what these words mean"
        >
          <BookOpenText />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>How DropX speaks</DialogTitle>
          <DialogDescription>
            The words you see on screen — what they mean and when to use them.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeGroup} onValueChange={setActiveGroup}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            {GLOSSARY_GROUPS.map((group) => (
              <TabsTrigger key={group.id} value={group.id}>
                {group.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {GLOSSARY_GROUPS.map((group) => (
            <TabsContent
              key={group.id}
              value={group.id}
              className="max-h-[58vh] overflow-y-auto pb-1"
            >
              <p className="text-muted-foreground pb-4 text-xs">{group.description}</p>
              <ul className="flex flex-col gap-5">
                {group.entries.map((entry) => (
                  <li key={entry.term}>
                    <p className="text-sm font-semibold">{entry.term}</p>
                    <p className="text-muted-foreground mt-0.5 text-sm">{entry.meaning}</p>
                    <p className="text-muted-foreground/80 mt-1.5 text-xs">
                      <span className="font-medium">Use when: </span>
                      {entry.whenToUse}
                    </p>
                  </li>
                ))}
              </ul>
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Got it</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
