"use client";

import { useEffect, useRef } from "react";
import { SendHorizontal } from "lucide-react";
import { ActionForm, FormSubmit, useActionForm } from "@/components/forms/action-form";
import { sendMessageAction } from "@/app/_actions/messaging";

export function ScrollToEnd({ count }: { count: number }) {
  useEffect(() => {
    const el = document.getElementById("thread");
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);
  return null;
}

function MessageBox() {
  const { state } = useActionForm();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.focus();
  }, [state]);
  return (
    <>
      <label htmlFor="body" className="sr-only">Message</label>
      <textarea id="body" name="body" ref={ref} rows={2} maxLength={4000} required
        defaultValue={state.values?.body ?? ""}
        placeholder="Write a message…"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
        }}
        className="min-h-11 flex-1 resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] text-ink focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none" />
      {state.errors?.body && <p className="sr-only" role="alert">{state.errors.body}</p>}
    </>
  );
}

export function Composer({ conversationId }: { conversationId: string }) {
  return (
    <ActionForm action={sendMessageAction.bind(null, conversationId)} resetOnSuccess showSuccess={false} className="space-y-2">
      <div className="flex items-end gap-2">
        <MessageBox />
        <FormSubmit pendingLabel="Sending…">
          <SendHorizontal className="size-4" aria-hidden /> Send
        </FormSubmit>
      </div>
      <p className="text-xs text-muted">Press ⌘/Ctrl + Enter to send. Keep conversations on TalentLoom until you&apos;re ready to work together.</p>
    </ActionForm>
  );
}
