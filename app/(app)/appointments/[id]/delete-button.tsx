"use client";

import { startTransition, useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
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
import { deleteAppointment, type DeleteActionState } from "../actions";

export function DeleteAppointmentButton({ id, summary }: { id: number; summary: string }) {
  const [state, run, pending] = useActionState<DeleteActionState>(() => deleteAppointment(id), {});
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button variant="destructive" disabled={pending} onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden="true" />
        {pending ? "Deleting…" : "Delete"}
      </Button>
      {state.message && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {state.message}
        </p>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              {summary} will be removed permanently. If the visit just isn&apos;t happening, cancel it
              instead so it stays on the customer&apos;s record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                setConfirming(false);
                startTransition(() => run());
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
