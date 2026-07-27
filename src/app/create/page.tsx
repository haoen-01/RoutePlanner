"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreferenceForm } from "@/components/PreferenceForm";
import { useRunFlowStore } from "@/store/runFlowStore";

export default function CreateRunPage() {
  const router = useRouter();
  const store = useRunFlowStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateRoutes() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/routes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(store.toCreateRunRequest()),
      });
      if (!res.ok) throw new Error("Route generation failed");
      const data = await res.json();
      store.setGenerated(data.runId, data.routes);
      router.push("/routes");
    } catch (e) {
      setError("Something went wrong generating routes. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Create your run</h1>
        <p className="mt-1 text-sm text-muted-foreground">Starting from {store.startLabel}. Adjust anything below, then generate route options.</p>
      </div>

      <PreferenceForm />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button size="lg" onClick={generateRoutes} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "Generating routes…" : "Generate AI routes"}
      </Button>
    </div>
  );
}
