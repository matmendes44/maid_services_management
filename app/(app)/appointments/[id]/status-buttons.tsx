"use client";

import { startTransition, useActionState, useState } from "react";
import { Ban, CheckCircle2, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { setAppointmentStatus, type StatusActionState } from "../actions";
import type { AppointmentStatus } from "../options";

// Complete / Cancel / Reopen, depending on the current status. Canceling asks
// for confirmation since it frees the vehicle's slot.
export function StatusButtons({ id, status }: { id: number; status: AppointmentStatus }) {
  const [state, run, pending] = useActionState(
    (_prev: StatusActionState, next: AppointmentStatus) => setAppointmentStatus(id, next),
    {},
  );
  const [confirmCancel, setConfirmCancel] = useState(false);
  const go = (next: AppointmentStatus) => startTransition(() => run(next));

  return (
    <>
      {status === "pending" && (
        <Button variant="outline" disabled={pending} onClick={() => go("completed")}>
          <CheckCircle2 aria-hidden="true" />
          Mark completed
        </Button>
      )}
      {status !== "canceled" && (
        <Button variant="outline" disabled={pending} onClick={() => setConfirmCancel(true)}>
          <Ban aria-hidden="true" />
          Cancel appointment
        </Button>
      )}
      {status !== "pending" && (
        <Button variant="outline" disabled={pending} onClick={() => go("pending")}>
          <RotateCcw aria-hidden="true" />
          Reopen
        </Button>
      )}
      {state.message && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {state.message}
        </p>
      )}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              It stays on record as canceled and its vehicle becomes free at this time. You can reopen it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmCancel(false);
                go("canceled");
              }}
            >
              Cancel appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
