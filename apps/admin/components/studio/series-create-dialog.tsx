"use client";

import { useMutation } from "convex/react";
import { Plus } from "lucide-react";
import { useState, type SyntheticEvent } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formText, slugify } from "./studio-form";

export function SeriesCreateDialog() {
  const createSeries = useMutation(api.series.createDraft);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = formText(data, "title");
    setWorking(true);
    setError(undefined);
    try {
      await createSeries({
        description: formText(data, "description"),
        genre: formText(data, "genre"),
        slug: slugify(title),
        title,
      });
      setOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create series.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New series
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a series</DialogTitle>
          <DialogDescription>
            Define the editorial container. Episode transcripts are developed
            later in their persistent production chats.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <Label className="grid gap-1.5">
            Series title
            <Input
              autoComplete="off"
              maxLength={120}
              name="title"
              placeholder="The Signal"
              required
            />
          </Label>
          <Label className="grid gap-1.5">
            Genre
            <Input
              autoComplete="off"
              maxLength={80}
              name="genre"
              placeholder="Science-fiction thriller"
              required
            />
          </Label>
          <Label className="grid gap-1.5">
            Series premise
            <Textarea
              autoComplete="off"
              maxLength={2000}
              name="description"
              placeholder="What makes this world and its central mystery worth returning to?"
              required
            />
          </Label>
          {error ? (
            <p aria-live="polite" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button disabled={working} type="submit">
            {working ? "Creating…" : "Create series"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
