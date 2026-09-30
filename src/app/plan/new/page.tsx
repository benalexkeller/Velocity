"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import "../plan.css";
import "../builder.css";
import { Builder } from "@/components/plan/Builder";

export default function NewPlanPage() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
function Inner() {
  const params = useSearchParams();
  return <main className="main"><Builder edit={params.get("edit") === "1"} importFirst={params.get("import") === "1"} /></main>;
}
